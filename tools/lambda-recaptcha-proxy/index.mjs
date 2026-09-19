// AWS Lambda (Node.js 20.x, ESM) — reCAPTCHA v3 verification + HubSpot Forms API proxy.
// Deploy/config details: see docs/CONTACT_FORM_SECURITY.md.

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const HUBSPOT_PORTAL_ID = '45485180';
const HUBSPOT_FORM_GUID = '0405692e-4885-4218-b038-731f1ea6fe82';
const HUBSPOT_ENDPOINT = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`;

const MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || '0.5');
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://drumwave.com';

const MARKETING_CONSENT_TEXT = 'I agree to receive other communications from DrumWave.';
const PROCESS_CONSENT_TEXT = 'By clicking Send below, you consent to allow DrumWave to store and process the personal information submitted above to provide you the content requested and acknowledge that you have reviewed and understand our Privacy Policy.';
const MARKETING_SUBSCRIPTION_TYPE_ID = 310392606; // "One to One" — HubSpot subscription definition id

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_OR_LINK_PATTERN = /<[a-z][\s\S]*>|https?:\/\/|www\./i;
const FIELD_MAX_LENGTHS = {
  firstname: 100,
  lastname: 100,
  email: 200,
  message_subject_line: 200,
  message: 5000,
  how_did_you_hear_about_us_: 200,
};

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(statusCode, body){
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  };
}

async function verifyRecaptcha(token, remoteIp){
  const params = new URLSearchParams({
    secret: RECAPTCHA_SECRET_KEY,
    response: token,
  });
  if(remoteIp) params.set('remoteip', remoteIp);

  const res = await fetch(RECAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.json();
}

export const handler = async (event) => {
  if(event.requestContext?.http?.method === 'OPTIONS'){
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  let payload;
  try{
    payload = JSON.parse(event.body || '{}');
  }catch(err){
    return jsonResponse(400, { error: 'invalid_json' });
  }

  const { recaptchaToken, contact } = payload;

  if(!recaptchaToken || typeof recaptchaToken !== 'string'){
    return jsonResponse(400, { error: 'missing_recaptcha_token' });
  }
  if(!contact || typeof contact !== 'object'){
    return jsonResponse(400, { error: 'missing_contact_payload' });
  }

  const requiredFields = ['firstname', 'lastname', 'email', 'message_subject_line', 'message'];
  for(const field of requiredFields){
    if(!contact[field] || typeof contact[field] !== 'string' || !contact[field].trim()){
      return jsonResponse(400, { error: 'missing_field', field });
    }
  }

  for(const [field, maxLength] of Object.entries(FIELD_MAX_LENGTHS)){
    const value = contact[field];
    if(typeof value === 'string' && value.length > maxLength){
      return jsonResponse(400, { error: 'field_too_long', field, maxLength });
    }
  }

  if(!EMAIL_PATTERN.test(contact.email.trim())){
    return jsonResponse(400, { error: 'invalid_email' });
  }

  if(HTML_OR_LINK_PATTERN.test(contact.message)){
    return jsonResponse(400, { error: 'message_contains_html_or_link' });
  }

  const sourceIp = event.requestContext?.http?.sourceIp;

  let verification;
  try{
    verification = await verifyRecaptcha(recaptchaToken, sourceIp);
  }catch(err){
    console.error('reCAPTCHA verification request failed', err);
    return jsonResponse(502, { error: 'recaptcha_verification_failed' });
  }

  if(!verification.success || (verification.score ?? 0) < MIN_SCORE || verification.action !== 'contact_form_submit'){
    console.warn('reCAPTCHA rejected submission', verification);
    return jsonResponse(403, { error: 'recaptcha_check_failed', score: verification.score });
  }

  const hubspotPayload = {
    fields: [
      { name: 'firstname', value: contact.firstname },
      { name: 'lastname', value: contact.lastname },
      { name: 'email', value: contact.email },
      { name: 'message_subject_line', value: contact.message_subject_line },
      { name: 'message', value: contact.message },
      { name: 'how_did_you_hear_about_us_', value: contact.how_did_you_hear_about_us_ || '' },
    ],
    context: {
      hutk: contact.hutk || undefined,
      pageUri: contact.pageUri,
      pageName: contact.pageName,
      ipAddress: sourceIp,
    },
    legalConsentOptions: {
      consent: {
        consentToProcess: true,
        text: PROCESS_CONSENT_TEXT,
        communications: [
          {
            value: Boolean(contact.marketingConsent),
            subscriptionTypeId: MARKETING_SUBSCRIPTION_TYPE_ID,
            text: MARKETING_CONSENT_TEXT,
          },
        ],
      },
    },
  };

  let hubspotRes;
  try{
    hubspotRes = await fetch(HUBSPOT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hubspotPayload),
    });
  }catch(err){
    console.error('HubSpot submission request failed', err);
    return jsonResponse(502, { error: 'hubspot_request_failed' });
  }

  if(!hubspotRes.ok){
    const errBody = await hubspotRes.json().catch(() => ({}));
    console.error('HubSpot rejected submission', errBody);
    return jsonResponse(502, { error: 'hubspot_rejected', details: errBody });
  }

  return jsonResponse(200, { ok: true });
};

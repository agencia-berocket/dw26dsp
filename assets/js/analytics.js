/*
 * Consent-gated analytics loader.
 * Loads GA4 + Google Ads, PostHog, Contentsquare, and the HubSpot tracking
 * code only after CookieScript reports the relevant consent category as
 * accepted — never unconditionally.
 */
(function () {
  var GA_MEASUREMENT_ID = 'G-7X38HBQD5Y';
  var GOOGLE_ADS_ID = 'AW-476679703';
  var POSTHOG_KEY = 'phc_z4E1BxQ6LzxNIQmBdZjzUSLFQXd50prpU2Ln9KJRdy2';
  var POSTHOG_API_HOST = 'https://ph.drumwave.com';
  var POSTHOG_UI_HOST = 'https://us.i.posthog.com';
  var CONTENTSQUARE_SRC = 'https://t.contentsquare.net/uxa/1d698713bff74.js';
  var HUBSPOT_PORTAL_ID = '45485180';
  var HUBSPOT_SRC = 'https://js.hs-scripts.com/' + HUBSPOT_PORTAL_ID + '.js';

  var loaded = { analytics: false, target: false };

  function loadScript(src, attrs) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    if (attrs) {
      for (var key in attrs) s[key] = attrs[key];
    }
    document.head.appendChild(s);
    return s;
  }

  function loadGoogleTags() {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID);
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
    gtag('config', GOOGLE_ADS_ID);
  }

  function loadPostHog() {
    !function (t, e) { var o, n, p, r; e.__SV || (window.posthog && window.posthog.__loaded) || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init hi Sr Er ui yr wr capture Ti calculateEventProperties Pr register register_once register_for_session unregister unregister_for_session Cr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Rr kr createPersonProfile Tr Or opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing $r debug L Ir getPageViewId captureTraceFeedback captureTraceMetric".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_API_HOST,
      ui_host: POSTHOG_UI_HOST,
      defaults: '2025-05-24',
      person_profiles: 'always'
    });
  }

  function loadContentsquare() {
    loadScript(CONTENTSQUARE_SRC);
  }

  function loadHubSpot() {
    loadScript(HUBSPOT_SRC, { id: 'hs-script-loader' });
  }

  function hasCategory(categories, name) {
    return !!categories && categories.indexOf(name) !== -1;
  }

  function applyConsent(categories) {
    if (!loaded.analytics && hasCategory(categories, 'analytics')) {
      loaded.analytics = true;
      loadGoogleTags();
      loadPostHog();
      loadContentsquare();
      loadHubSpot();
    }
    if (!loaded.target && hasCategory(categories, 'target')) {
      loaded.target = true;
    }
  }

  function readCurrentConsent() {
    if (window.CookieScript && window.CookieScript.instance) {
      try {
        return window.CookieScript.instance.currentState().categories;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  ['CookieScriptAccept', 'CookieScriptAcceptAll', 'CookieScriptCurrentState'].forEach(function (name) {
    document.addEventListener(name, function (e) {
      applyConsent(e && e.detail ? e.detail.categories : readCurrentConsent());
    });
  });
  document.addEventListener('CookieScriptLoaded', function () {
    applyConsent(readCurrentConsent());
  });

  // In case CookieScript already resolved consent before this script ran.
  applyConsent(readCurrentConsent());
})();

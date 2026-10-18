// Panel de administración de TuEventoFun (AngularJS 1.8). Sin dependencias: lo sirve el propio admin.
(function () {
  "use strict";

  var LANGS = ["es", "en", "pt", "de", "fr"];
  var DATE_LOCALES = { es: "es-ES", en: "en-GB", pt: "pt-BR", de: "de-DE", fr: "fr-FR" };
  var LANG_KEY = "admin.lang";
  var REFRESH_MS = 60 * 1000;

  function initialLang() {
    try {
      var saved = window.localStorage.getItem(LANG_KEY);
      if (LANGS.indexOf(saved) !== -1) return saved;
    } catch (e) {
      // Sin almacenamiento (modo privado): se usa el idioma del navegador.
    }
    var browser = (navigator.language || "es").slice(0, 2);
    return LANGS.indexOf(browser) !== -1 ? browser : "es";
  }

  angular.module("admin", []).controller("AdminController", ["$http", "$interval", "$scope", "$document", function ($http, $interval, $scope, $document) {
    var vm = this;
    var dict = {};
    var fallback = {};

    vm.lang = initialLang();
    vm.session = "checking"; // checking | out | in
    vm.tab = "summary";
    vm.days = 30;
    vm.page = 1;
    vm.busy = false;
    vm.error = "";
    vm.loginError = "";
    vm.credentials = { username: "", password: "" };
    vm.stats = null;
    vm.users = null;
    vm.events = null;

    // ── Textos ──────────────────────────────────────────────────────────────
    function loadDictionary(lang) {
      return $http.get("/i18n/" + lang + ".json", { cache: true }).then(function (res) {
        dict = res.data;
        $document[0].documentElement.lang = lang;
        $document[0].title = dict["app.title"];
      });
    }

    vm.t = function (key, vars) {
      var text = dict[key] || fallback[key] || key;
      return text.replace(/\{\{(\w+)\}\}/g, function (_, name) {
        return vars && vars[name] !== undefined ? vars[name] : "";
      });
    };

    vm.setLang = function () {
      try {
        window.localStorage.setItem(LANG_KEY, vm.lang);
      } catch (e) {
        // Sin almacenamiento: el idioma solo dura esta visita.
      }
      loadDictionary(vm.lang).then(function () {
        $scope.$applyAsync();
      });
    };

    vm.date = function (value) {
      if (!value) return "";
      return new Date(value).toLocaleDateString(DATE_LOCALES[vm.lang], { day: "2-digit", month: "short", year: "numeric" });
    };

    // ── Gráficas: barras proporcionales, sin librerías ──────────────────────
    vm.maxOf = function (rows, field) {
      return Math.max(1, Math.max.apply(null, (rows || []).map(function (r) { return r[field] || 0; })));
    };
    vm.share = function (value, max) {
      return Math.round(((value || 0) / max) * 100);
    };
    vm.totalOnline = function () {
      if (!vm.stats) return 0;
      return vm.stats.overview.online.reduce(function (sum, p) { return sum + p.visitors; }, 0);
    };

    // ── Red ─────────────────────────────────────────────────────────────────
    function request(method, url, body) {
      vm.busy = true;
      vm.error = "";
      return $http({ method: method, url: url, data: body, headers: { "Content-Type": "application/json" } })
        .then(function (res) {
          vm.busy = false;
          return res.data;
        })
        .catch(function (res) {
          vm.busy = false;
          if (res.status === 401) {
            vm.session = "out";
            return Promise.reject(res);
          }
          vm.error = "error.generic";
          return Promise.reject(res);
        });
    }

    vm.login = function () {
      vm.loginError = "";
      vm.busy = true;
      $http.post("/api/login", vm.credentials, { headers: { "Content-Type": "application/json" } })
        .then(function () {
          vm.busy = false;
          vm.credentials.password = "";
          vm.session = "in";
          vm.show("summary");
        })
        .catch(function (res) {
          vm.busy = false;
          vm.credentials.password = "";
          vm.loginError = res.status === 429 ? "login.blocked" : "login.invalid";
        });
    };

    vm.logout = function () {
      $http.post("/api/logout", {}, { headers: { "Content-Type": "application/json" } }).finally(function () {
        vm.session = "out";
        vm.stats = vm.users = vm.events = null;
      });
    };

    vm.loadStats = function () {
      return request("GET", "/api/stats?days=" + vm.days).then(function (data) {
        vm.stats = data;
      }).catch(angular.noop);
    };

    vm.show = function (tab) {
      vm.tab = tab;
      vm.page = 1;
      vm.reload();
    };

    vm.go = function (page) {
      vm.page = Math.max(1, page);
      vm.reload();
    };

    vm.reload = function () {
      if (vm.session !== "in") return;
      if (vm.tab === "summary") return vm.loadStats();
      if (vm.tab === "users") {
        return request("GET", "/api/users?page=" + vm.page).then(function (data) { vm.users = data; }).catch(angular.noop);
      }
      return request("GET", "/api/events?page=" + vm.page).then(function (data) { vm.events = data; }).catch(angular.noop);
    };

    // Actualiza el resumen cada minuto para ver a los conectados avanzar.
    var timer = $interval(function () {
      if (vm.session === "in" && vm.tab === "summary" && !vm.busy) vm.loadStats();
    }, REFRESH_MS);
    $scope.$on("$destroy", function () { $interval.cancel(timer); });

    // ── Arranque ────────────────────────────────────────────────────────────
    loadDictionary("es").then(function () {
      fallback = dict;
      return vm.lang === "es" ? null : loadDictionary(vm.lang);
    }).then(function () {
      return $http.get("/api/session");
    }).then(function () {
      vm.session = "in";
      vm.show("summary");
    }).catch(function (res) {
      if (res && res.status !== 401) vm.error = "error.generic";
      vm.session = "out";
    });
  }]);
})();

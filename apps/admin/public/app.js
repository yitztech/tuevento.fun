// Panel de administración de TuEventoFun (AngularJS 1.8). Sin dependencias: lo sirve el propio admin.
(function () {
  "use strict";

  var REFRESH_MS = 60 * 1000;
  var PLATFORMS = { web: "Web", android: "Android", ios: "iOS" };
  var THEMES = {
    gold: "Dorado", neon: "Neón", tropical: "Tropical", minimal: "Minimalista", floral: "Floral", kids: "Infantil",
    winter: "Invierno", spring: "Primavera", autumn: "Otoño", silver: "Plata", copper: "Cobre", disco: "Disco",
    starlight: "Luz de estrellas", sand: "Arena", wildflower: "Flores silvestres", pastel: "Pastel"
  };
  var MESSAGES = {
    invalid: "Usuario o contraseña incorrectos.",
    blocked: "Demasiados intentos. Espera unos minutos.",
    error: "No se pudieron cargar los datos."
  };

  angular.module("admin", []).controller("AdminController", ["$http", "$interval", "$scope", function ($http, $interval, $scope) {
    var vm = this;

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
    vm.platformName = function (platform) {
      return PLATFORMS[platform] || platform;
    };
    vm.themeName = function (theme) {
      return THEMES[theme] || theme;
    };
    vm.date = function (value) {
      if (!value) return "";
      return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
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
    function request(url) {
      vm.busy = true;
      vm.error = "";
      return $http.get(url)
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
          vm.error = MESSAGES.error;
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
          vm.loginError = res.status === 429 ? MESSAGES.blocked : MESSAGES.invalid;
        });
    };

    vm.logout = function () {
      $http.post("/api/logout", {}, { headers: { "Content-Type": "application/json" } }).finally(function () {
        vm.session = "out";
        vm.stats = vm.users = vm.events = null;
      });
    };

    vm.loadStats = function () {
      return request("/api/stats?days=" + vm.days).then(function (data) {
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
        return request("/api/users?page=" + vm.page).then(function (data) { vm.users = data; }).catch(angular.noop);
      }
      return request("/api/events?page=" + vm.page).then(function (data) { vm.events = data; }).catch(angular.noop);
    };

    // Actualiza el resumen cada minuto para ver a los conectados avanzar.
    var timer = $interval(function () {
      if (vm.session === "in" && vm.tab === "summary" && !vm.busy) vm.loadStats();
    }, REFRESH_MS);
    $scope.$on("$destroy", function () { $interval.cancel(timer); });

    // ── Arranque ────────────────────────────────────────────────────────────
    $http.get("/api/session").then(function () {
      vm.session = "in";
      vm.show("summary");
    }).catch(function (res) {
      if (res && res.status !== 401) vm.error = MESSAGES.error;
      vm.session = "out";
    });
  }]);
})();

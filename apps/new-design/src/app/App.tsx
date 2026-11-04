import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollManager } from "@/app/ScrollManager";
import { Layout } from "@/components/layout/Layout";
import { Home } from "@/pages/Home/Home";
import { NotFound } from "@/pages/NotFound";

const Login = lazy(() => import("@/pages/Login/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("@/pages/Register/Register").then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword/ForgotPassword").then((m) => ({ default: m.ForgotPassword })));
const Providers = lazy(() => import("@/pages/Providers/Providers").then((m) => ({ default: m.Providers })));
const Demo = lazy(() => import("@/pages/Demo/Demo").then((m) => ({ default: m.Demo })));

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Suspense fallback={<div className="min-h-dvh" />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="registro" element={<Register />} />
            <Route path="recuperar-contrasena" element={<ForgotPassword />} />
            <Route path="proveedores" element={<Providers />} />
            <Route path="demo" element={<Demo />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

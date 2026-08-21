import {
    BrowserRouter,
    Routes,
    Route,
} from "react-router-dom";

import Home from "../pages/home";
import NotFound from "../pages/notfound";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Contact from "../pages/Contact";

import PrivateRoutes from "./PrivateRoutes";

export default function AppRoutes() {

    return (
        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={<Home />}
                />

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/contato"
                    element={<Contact />}
                />

                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoutes>
                            <Dashboard />
                        </PrivateRoutes>
                    }
                />

                <Route
                    path="*"
                    element={<NotFound />}
                />

            </Routes>

        </BrowserRouter>
    );
}

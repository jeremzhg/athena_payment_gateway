import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { athenaLogin } from "../services/api";

export const LoginPage = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("admin");
    const [password, setPassword] = useState("password");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            await athenaLogin(username, password);
            localStorage.setItem("athena-authenticated", "true");
            navigate("/dashboard");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Login failed";
            setError(message.includes("401") ? "Invalid username or password" : "Login failed");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-dark text-white flex items-center justify-center px-4">
            <div className="w-full max-w-md border border-dark-border rounded-xl p-6 bg-darkish-grey">
                <h1 className="text-2xl font-semibold">Athena Login</h1>
                <p className="text-slate mt-1 text-sm">Sign in with the configured user account.</p>

                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="username" className="text-sm text-slate block mb-2">Username</label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="admin"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="text-sm text-slate block mb-2">Password</label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="password"
                            required
                        />
                    </div>

                    {error ? <p className="text-red-300 text-sm">{error}</p> : null}

                    <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? "Signing in..." : "Sign In"}
                    </Button>
                </form>
            </div>
        </div>
    );
};

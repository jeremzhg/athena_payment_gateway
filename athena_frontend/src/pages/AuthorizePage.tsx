import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { authorizeMcpToken, getAgentAccounts, type AgentAccountDto } from "../services/api";

export const AuthorizePage = () => {
    const [searchParams] = useSearchParams();
    const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

    const [accounts, setAccounts] = useState<AgentAccountDto[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await getAgentAccounts();
                setAccounts(response);
                if (response.length > 0) {
                    setSelectedAccountId(response[0].accountId);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load accounts");
            } finally {
                setLoading(false);
            }
        };

        fetchAccounts();
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!token) {
            setError("Missing token in URL");
            return;
        }

        if (!selectedAccountId) {
            setError("Please select an account");
            return;
        }

        setSubmitting(true);
        try {
            const response = await authorizeMcpToken(token, selectedAccountId);
            setSuccess(response.message);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Authorization failed");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-dark text-white flex items-center justify-center px-4">
            <div className="w-full max-w-xl border border-dark-border rounded-xl p-6 bg-darkish-grey">
                <h1 className="text-2xl font-semibold">Authorize MCP Token</h1>
                <p className="text-slate mt-1 text-sm break-all">Token: {token || "(missing)"}</p>

                {loading ? (
                    <p className="text-slate mt-6">Loading accounts...</p>
                ) : (
                    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="text-sm text-slate block mb-2" htmlFor="account-select">Agent Account</label>
                            <select
                                id="account-select"
                                value={selectedAccountId}
                                onChange={(event) => setSelectedAccountId(event.target.value)}
                                className="w-full h-12 px-4 rounded-lg border border-dark-border bg-dark text-white"
                            >
                                {accounts.length === 0 ? (
                                    <option value="">No accounts found</option>
                                ) : (
                                    accounts.map((account) => (
                                        <option key={account.accountId} value={account.accountId}>
                                            {account.accountId} — ${account.balanceLimit.toFixed(2)} — {account.rule}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {error ? <p className="text-red-300 text-sm">{error}</p> : null}
                        {success ? <p className="text-emerald-300 text-sm">{success}</p> : null}

                        <div className="flex gap-3">
                            <Button type="submit" disabled={submitting || accounts.length === 0}>
                                {submitting ? "Authorizing..." : "Authorize Token"}
                            </Button>
                            <Link to="/dashboard" className="inline-flex items-center text-slate hover:text-white text-sm">
                                Back to Dashboard
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

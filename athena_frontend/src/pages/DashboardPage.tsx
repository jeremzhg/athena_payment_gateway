import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getAgentAccounts, saveAgentAccount, type AgentAccountDto } from "../services/api";

export const DashboardPage = () => {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<AgentAccountDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [accountId, setAccountId] = useState("");
    const [balanceLimit, setBalanceLimit] = useState("50");
    const [rule, setRule] = useState("Only for grocery");

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const response = await getAgentAccounts();
            setAccounts(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load accounts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");

        const parsedLimit = Number(balanceLimit);
        if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
            setError("Balance limit must be a positive number");
            return;
        }

        if (!rule.trim()) {
            setError("Rule cannot be empty");
            return;
        }

        setSaving(true);
        try {
            await saveAgentAccount({
                accountId: accountId.trim() || undefined,
                balanceLimit: parsedLimit,
                rule: rule.trim(),
            });
            setAccountId("");
            setBalanceLimit("50");
            setRule("Only for grocery");
            await loadAccounts();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save account");
        } finally {
            setSaving(false);
        }
    };

    const selectForEdit = (account: AgentAccountDto) => {
        setAccountId(account.accountId);
        setBalanceLimit(String(account.balanceLimit));
        setRule(account.rule);
    };

    const logout = () => {
        localStorage.removeItem("athena-authenticated");
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-dark text-white px-4 py-8">
            <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-2">
                <section className="border border-dark-border rounded-xl p-6 bg-darkish-grey">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold">Agent Accounts</h1>
                            <p className="text-slate mt-1 text-sm">Create or update account limit and rule.</p>
                        </div>
                        <Button variant="outline" onClick={logout}>Logout</Button>
                    </div>

                    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="accountId" className="text-sm text-slate block mb-2">Account ID (optional for create)</label>
                            <Input
                                id="accountId"
                                placeholder="acc_grocery"
                                value={accountId}
                                onChange={(event) => setAccountId(event.target.value)}
                            />
                        </div>

                        <div>
                            <label htmlFor="limit" className="text-sm text-slate block mb-2">Balance Limit</label>
                            <Input
                                id="limit"
                                type="number"
                                min="0"
                                step="0.01"
                                value={balanceLimit}
                                onChange={(event) => setBalanceLimit(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="rule" className="text-sm text-slate block mb-2">Rule</label>
                            <Input
                                id="rule"
                                placeholder="Only for grocery"
                                value={rule}
                                onChange={(event) => setRule(event.target.value)}
                                required
                            />
                        </div>

                        {error ? <p className="text-red-300 text-sm">{error}</p> : null}

                        <Button type="submit" disabled={saving}>
                            {saving ? "Saving..." : accountId ? "Update Account" : "Create Account"}
                        </Button>
                    </form>
                </section>

                <section className="border border-dark-border rounded-xl p-6 bg-darkish-grey">
                    <h2 className="text-xl font-semibold">Existing Accounts</h2>
                    {loading ? (
                        <p className="text-slate mt-4">Loading...</p>
                    ) : accounts.length === 0 ? (
                        <p className="text-slate mt-4">No accounts found. Create one to start.</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {accounts.map((account) => (
                                <div
                                    key={account.accountId}
                                    className="border border-dark-border rounded-lg p-4 flex items-start justify-between gap-3"
                                >
                                    <div>
                                        <p className="font-medium">{account.accountId}</p>
                                        <p className="text-slate text-sm">Limit: ${account.balanceLimit.toFixed(2)}</p>
                                        <p className="text-slate text-sm">Rule: {account.rule}</p>
                                    </div>
                                    <Button variant="outline" onClick={() => selectForEdit(account)}>Edit</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

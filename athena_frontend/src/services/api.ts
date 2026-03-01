/**
 * API service layer for the Athena frontend.
 * Provides typed fetch wrappers for all backend endpoints.
 */

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ── Backend Types ──────────────────────────────────────────────────────

export interface ApiCategory {
    id: number;
    name: string;
    initial_limit: number;
    remaining_budget: number;
    domains: string[];
}

export interface ApiHistoryItem {
    id: number;
    user_task: string;
    active_account_category: string;
    transaction_amount: number;
    decision: "ALLOW" | "BLOCK";
    timestamp: string;
}

export interface InterceptRequest {
    user_task: string;
    active_account_category: string;
    transaction_amount: number;
}

export interface InterceptResponse {
    decision: "ALLOW" | "BLOCK";
    extracted_data: {
        target_domain: string;
        purchase_nature: string;
    };
    context_verification: {
        account_category: string;
        is_context_valid: boolean;
        context_reasoning: string;
    };
    whitelist_verification: {
        is_domain_approved: boolean;
        whitelist_reasoning: string;
    };
    limit_verification: {
        initial_limit: number;
        remaining_budget: number;
    };
    security_summary: string;
}

// ── Dashboard UI Types (derived from API data) ─────────────────────────

export interface DashboardStat {
    id: string;
    title: string;
    value: string;
    subtitle: string;
    subtitleColor: "emerald" | "red" | "slate";
    iconType: "server" | "search" | "shield" | "bot";
    trend?: "up" | "down" | "neutral";
}

export interface ChartDataPoint {
    time: string;
    allowed: number;
    blocked: number;
}

export interface DashboardData {
    stats: DashboardStat[];
    chartData: ChartDataPoint[];
}

// ── Generic fetch wrapper ──────────────────────────────────────────────

async function apiClient<T>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
        ...options,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
            `API error: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ""}`
        );
    }

    return response.json() as Promise<T>;
}

// ── Category endpoints ─────────────────────────────────────────────────

export async function getCategories(): Promise<ApiCategory[]> {
    return apiClient<ApiCategory[]>("/v1/categories");
}

export async function createCategory(
    name: string,
    limit: number,
    domains: string[] = []
): Promise<{ status: string; category: string; limit: number; message: string }> {
    return apiClient("/v1/categories", {
        method: "POST",
        body: JSON.stringify({ name, limit, domains }),
    });
}

export async function updateCategoryDomains(
    categoryName: string,
    domains: string[]
): Promise<{ status: string; category: string; message: string }> {
    return apiClient(`/v1/categories/${encodeURIComponent(categoryName)}`, {
        method: "PUT",
        body: JSON.stringify({ domains }),
    });
}

// ── Intercept endpoint ─────────────────────────────────────────────────

export async function postIntercept(
    request: InterceptRequest
): Promise<InterceptResponse> {
    return apiClient<InterceptResponse>("/v1/intercept", {
        method: "POST",
        body: JSON.stringify(request),
    });
}

// ── History endpoint ───────────────────────────────────────────────────

export async function getHistory(): Promise<ApiHistoryItem[]> {
    return apiClient<ApiHistoryItem[]>("/v1/history");
}

// ── Dashboard data (derived from real endpoints) ───────────────────────

export type TimeRange = "24h" | "7d" | "30d";

export async function getDashboardData(timeRange: TimeRange = "24h"): Promise<DashboardData> {
    const [categories, history] = await Promise.all([
        getCategories(),
        getHistory(),
    ]);

    // Compute stats from real data
    const totalSpent = categories.reduce(
        (sum, c) => sum + (c.initial_limit - c.remaining_budget),
        0
    );

    const now = new Date();
    
    // Filter history based on timeRange
    const filteredHistory = history.filter(item => {
        const itemDate = new Date(item.timestamp);
        const diffTime = now.getTime() - itemDate.getTime();
        const diffHours = diffTime / (1000 * 60 * 60);
        
        if (timeRange === "24h") return diffHours <= 24;
        if (timeRange === "7d") return diffHours <= 24 * 7;
        if (timeRange === "30d") return diffHours <= 24 * 30;
        return true;
    });

    const totalTransactions = filteredHistory.length;
    const blockedCount = filteredHistory.filter((h) => h.decision === "BLOCK").length;
    const activeCategories = categories.length;

    const stats: DashboardStat[] = [
        {
            id: "monthly-spend",
            title: "Monthly Spend",
            value: `$${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            subtitle: `Across ${activeCategories} categories`,
            subtitleColor: totalSpent > 0 ? "red" : "slate",
            iconType: "server",
        },
        {
            id: "transactions-scanned",
            title: "Transactions Scanned",
            value: totalTransactions.toLocaleString(),
            subtitle: `${totalTransactions} total intercepts`,
            subtitleColor: "emerald",
            iconType: "search",
        },
        {
            id: "blocked-transactions",
            title: "Blocked Transactions",
            value: blockedCount.toString(),
            subtitle: "Over limit or unauthorized",
            subtitleColor: blockedCount > 0 ? "red" : "slate",
            iconType: "shield",
        },
        {
            id: "active-categories",
            title: "Active Categories",
            value: activeCategories.toString(),
            subtitle: "Budget tracking active",
            subtitleColor: "slate",
            iconType: "bot",
        },
    ];

    let chartData: ChartDataPoint[] = [];

    if (timeRange === "24h") {
        // Build chart data — group history by hour
        const hourBuckets: Record<string, { allowed: number; blocked: number }> = {};
        for (let h = 0; h < 24; h += 2) {
            const label = `${h.toString().padStart(2, "0")}:00`;
            hourBuckets[label] = { allowed: 0, blocked: 0 };
        }

        for (const item of filteredHistory) {
            const date = new Date(item.timestamp);
            const hourSlot = Math.floor(date.getHours() / 2) * 2;
            const label = `${hourSlot.toString().padStart(2, "0")}:00`;
            if (hourBuckets[label]) {
                if (item.decision === "ALLOW") hourBuckets[label].allowed++;
                else hourBuckets[label].blocked++;
            }
        }

        chartData = Object.entries(hourBuckets).map(
            ([time, counts]) => ({ time, ...counts })
        );
    } else {
        // Build chart data - group history by day for 7d or 30d
        const days = timeRange === "7d" ? 7 : 30;
        const dayBuckets: Record<string, { allowed: number; blocked: number }> = {};
        
        // Initialize buckets
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const label = `${d.getMonth() + 1}/${d.getDate().toString().padStart(2, '0')}`;
            dayBuckets[label] = { allowed: 0, blocked: 0 };
        }

        for (const item of filteredHistory) {
            const date = new Date(item.timestamp);
            const label = `${date.getMonth() + 1}/${date.getDate().toString().padStart(2, '0')}`;
            if (dayBuckets[label]) {
                if (item.decision === "ALLOW") dayBuckets[label].allowed++;
                else dayBuckets[label].blocked++;
            }
        }

        chartData = Object.entries(dayBuckets).map(
            ([time, counts]) => ({ time, ...counts })
        );
    }

    return { stats, chartData };
}

// ── Auth endpoints ─────────────────────────────────────────────────────

export interface AuthResponse {
    status: string;
    user_id: number;
    email: string;
    name: string;
    message: string;
}

export async function login(
    email: string,
    password: string
): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export async function signup(
    email: string,
    password: string,
    name: string = ""
): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
    });
}

// ── Category delete/patch ──────────────────────────────────────────────

export async function deleteCategory(
    categoryName: string
): Promise<{ status: string; message: string }> {
    return apiClient(`/v1/categories/${encodeURIComponent(categoryName)}`, {
        method: "DELETE",
    });
}

export async function patchCategory(
    categoryName: string,
    updates: { name?: string; limit?: number }
): Promise<{
    status: string;
    category: string;
    initial_limit: number;
    remaining_budget: number;
    message: string;
}> {
    return apiClient(
        `/v1/categories/${encodeURIComponent(categoryName)}`,
        {
            method: "PATCH",
            body: JSON.stringify(updates),
        }
    );
}

// ── Settings endpoints ─────────────────────────────────────────────────

export interface ProfileData {
    name: string;
    email: string;
    timezone: string;
    two_fa_enabled: boolean;
    session_timeout: number;
    email_notifications: boolean;
    threat_alerts: boolean;
    weekly_report: boolean;
    agent_status_alerts: boolean;
    api_key: string;
}

export async function getProfile(): Promise<ProfileData> {
    return apiClient<ProfileData>("/v1/settings/profile");
}

export async function updateProfile(
    updates: Partial<Omit<ProfileData, "api_key">>
): Promise<{ status: string; message: string }> {
    return apiClient("/v1/settings/profile", {
        method: "PUT",
        body: JSON.stringify(updates),
    });
}

export async function changePassword(
    currentPassword: string,
    newPassword: string
): Promise<{ status: string; message: string }> {
    return apiClient("/v1/settings/password", {
        method: "PUT",
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
        }),
    });
}

export async function regenerateApiKey(): Promise<{
    status: string;
    api_key: string;
}> {
    return apiClient("/v1/settings/api-key/regenerate", {
        method: "POST",
    });
}

// ── Spec-compliant Athena POC endpoints ───────────────────────────────

export interface AthenaLoginResponse {
    status: string;
    username: string;
    message: string;
}

export interface AgentAccountDto {
    accountId: string;
    balanceLimit: number;
    rule: string;
}

export async function athenaLogin(
    username: string,
    password: string
): Promise<AthenaLoginResponse> {
    return apiClient<AthenaLoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
}

export async function getAgentAccounts(): Promise<AgentAccountDto[]> {
    return apiClient<AgentAccountDto[]>("/accounts");
}

export async function saveAgentAccount(payload: {
    accountId?: string;
    balanceLimit: number;
    rule: string;
}): Promise<AgentAccountDto> {
    return apiClient<AgentAccountDto>("/accounts", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function authorizeMcpToken(
    mcp_token: string,
    accountId: string
): Promise<{ status: string; mcp_token: string; accountId: string; message: string }> {
    return apiClient("/auth/authorize-mcp", {
        method: "POST",
        body: JSON.stringify({ mcp_token, accountId }),
    });
}

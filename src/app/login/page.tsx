"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { Loader2, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error ?? "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const next = searchParams.get("next");
      const fallback = data.role === "admin" ? "/admin" : "/portal";
      router.push(next && next.startsWith(`/${data.role === "admin" ? "admin" : "portal"}`) ? next : fallback);
      router.refresh();
    } catch {
      setError("네트워크 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6 py-12">
      <div className="w-full max-w-[400px] animate-menu-item">
        <div className="text-center mb-8">
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)]">I.S. SEA &amp; AIR CO.,LTD</h1>
          <p className="text-[13px] text-[var(--muted)] mt-1">수출입 FCL 견적 시스템</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>로그인</CardTitle>
            <CardDescription>관리자 또는 화주 계정으로 로그인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <FieldLabel>아이디</FieldLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>비밀번호</FieldLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </FieldGroup>
              {error && <p className="text-[13px] text-[var(--danger)]">{error}</p>}
              <Button
                type="submit"
                className="w-full justify-center"
                disabled={submitting || !username || !password}
                icon={submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              >
                {submitting ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

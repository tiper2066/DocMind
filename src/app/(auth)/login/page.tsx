import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">DocMind</h1>
          <p className="text-sm text-muted-foreground">
            @pentasecurity.com 계정으로 로그인하세요
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="w-full"
        >
          <Button type="submit" className="w-full" size="lg">
            Google 로 로그인
          </Button>
        </form>
      </div>
    </main>
  );
}

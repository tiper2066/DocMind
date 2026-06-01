import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-surface px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-xl bg-canvas p-8 shadow-elevation-2 ring-1 ring-hairline">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-heading text-heading-2 text-ink">DocMind</h1>
          <p className="text-body-sm leading-relaxed text-steel">
            안녕하세요. 문서 작성, 이제 DocMind 에 맡겨보세요.
            <br />
            <span className="text-stone">@pentasecurity.com</span> 계정으로
            시작합니다.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="w-full"
        >
          <Button type="submit" className="h-11 w-full" size="lg">
            Google 로 로그인
          </Button>
        </form>
      </div>
    </main>
  );
}

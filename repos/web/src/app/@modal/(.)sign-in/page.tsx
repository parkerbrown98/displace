"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { SignInPanel } from "@/features/auth/sign-in-panel";

export default function InterceptedSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Modal title="Sign in" onDismiss={() => router.back()}>
      <SignInPanel returnTo={searchParams.get("returnTo") ?? undefined} />
    </Modal>
  );
}
"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { SignInPanel } from "@/features/auth/sign-in-panel";

export default function InterceptedSignInPage() {
  const router = useRouter();

  return (
    <Modal title="Sign in" onDismiss={() => router.back()}>
      <SignInPanel />
    </Modal>
  );
}
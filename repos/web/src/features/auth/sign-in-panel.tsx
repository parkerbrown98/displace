import { FormField } from "@/components/ui/form-field";

export function SignInPanel() {
  return (
    <form className="auth-form">
      <FormField autoComplete="email" label="Email" name="email" type="email" required />
      <FormField autoComplete="current-password" label="Password" name="password" type="password" required />
      <button className="primary-button" type="submit">Sign in</button>
    </form>
  );
}
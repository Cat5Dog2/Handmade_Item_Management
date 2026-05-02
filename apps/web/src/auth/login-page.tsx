import { useState } from "react";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { useZodForm } from "../forms/use-zod-form";
import { APP_NAME, AUTH_MESSAGES } from "../messages/display-messages";
import { LoginRecordError, useAppAuth } from "./auth-provider";
import { useAuthSession } from "./auth-session";

const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください。")
    .email("メールアドレスの形式を確認してください。"),
  password: z.string().min(1, "パスワードを入力してください。")
});

const passwordResetFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください。")
    .email("メールアドレスの形式を確認してください。")
});

function LoginPage() {
  const { clearAuthNotice, authNotice } = useAuthSession();
  const { login, sendPasswordResetEmail } = useAppAuth();
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordResetMessage, setPasswordResetMessage] = useState<
    string | null
  >(null);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(
    null
  );

  const loginForm = useZodForm(loginFormSchema, {
    defaultValues: {
      email: "",
      password: ""
    },
    mode: "onChange"
  });
  const passwordResetForm = useZodForm(passwordResetFormSchema, {
    defaultValues: {
      email: ""
    },
    mode: "onChange"
  });
  const emailValue = loginForm.watch("email");
  const displayedAuthMessage = loginError ?? authNotice;

  const openPasswordResetDialog = () => {
    setPasswordResetError(null);
    setPasswordResetMessage(null);
    passwordResetForm.reset({
      email: emailValue.trim()
    });
    setIsPasswordResetOpen(true);
  };

  const closePasswordResetDialog = () => {
    setPasswordResetError(null);
    setPasswordResetMessage(null);
    setIsPasswordResetOpen(false);
  };

  const handleLogin = loginForm.handleSubmit(async (values) => {
    setLoginError(null);
    clearAuthNotice();

    try {
      await login(values);
      loginForm.reset();
    } catch (error) {
      setLoginError(
        error instanceof LoginRecordError
          ? AUTH_MESSAGES.loginRecordFailed
          : AUTH_MESSAGES.loginFailed
      );
    }
  });

  const handlePasswordReset = passwordResetForm.handleSubmit(async (values) => {
    setPasswordResetError(null);
    setPasswordResetMessage(null);

    try {
      await sendPasswordResetEmail(values.email);
      setPasswordResetMessage(AUTH_MESSAGES.passwordResetSucceeded);
    } catch {
      setPasswordResetError(AUTH_MESSAGES.passwordResetFailed);
    }
  });

  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="auth-panel__brand">{APP_NAME}</p>
        <h1 id="login-title">ログイン</h1>
        {displayedAuthMessage ? (
          <p className="auth-panel__notice" role="alert">
            {displayedAuthMessage}
          </p>
        ) : null}
        <p className="auth-panel__summary">
          本人アカウントで続行し、その日の状態確認から始めます。
        </p>
        <form className="auth-form" onSubmit={handleLogin} noValidate>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="login-email">
              メールアドレス
            </label>
            <input
              {...loginForm.register("email")}
              id="login-email"
              autoComplete="username"
              className="auth-field__input"
              type="email"
            />
            {loginForm.formState.errors.email ? (
              <p className="auth-field__error" role="alert">
                {loginForm.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="login-password">
              パスワード
            </label>
            <input
              {...loginForm.register("password")}
              id="login-password"
              autoComplete="current-password"
              className="auth-field__input"
              type="password"
            />
            {loginForm.formState.errors.password ? (
              <p className="auth-field__error" role="alert">
                {loginForm.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="auth-panel__actions">
            <button
              className="primary-button"
              type="submit"
              disabled={
                !loginForm.formState.isValid || loginForm.formState.isSubmitting
              }
            >
              {loginForm.formState.isSubmitting ? "ログイン中..." : "ログイン"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={openPasswordResetDialog}
            >
              パスワードを再設定する
            </button>
          </div>
        </form>
      </section>
      {isPasswordResetOpen ? (
        <div className="auth-dialog__backdrop" role="presentation">
          <section
            aria-labelledby="password-reset-title"
            aria-modal="true"
            className="auth-dialog"
            role="dialog"
          >
            <h2 id="password-reset-title">パスワード再設定</h2>
            <p className="auth-dialog__summary">
              登録済みのメールアドレスへ再設定メールを送ります。
            </p>
            {passwordResetMessage ? (
              <p className="auth-dialog__success" role="status">
                {passwordResetMessage}
              </p>
            ) : null}
            {passwordResetError ? (
              <p className="auth-dialog__error" role="alert">
                {passwordResetError}
              </p>
            ) : null}
            <form
              className="auth-form"
              onSubmit={handlePasswordReset}
              noValidate
            >
              <div className="auth-field">
                <label
                  className="auth-field__label"
                  htmlFor="password-reset-email"
                >
                  メールアドレス
                </label>
                <input
                  {...passwordResetForm.register("email")}
                  id="password-reset-email"
                  autoComplete="email"
                  className="auth-field__input"
                  type="email"
                />
                {passwordResetForm.formState.errors.email ? (
                  <p className="auth-field__error" role="alert">
                    {passwordResetForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="auth-dialog__actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={passwordResetForm.formState.isSubmitting}
                  onClick={closePasswordResetDialog}
                >
                  閉じる
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    !passwordResetForm.formState.isValid ||
                    passwordResetForm.formState.isSubmitting
                  }
                >
                  {passwordResetForm.formState.isSubmitting
                    ? "送信中..."
                    : "送信"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export function AuthStatusPage() {
  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-status-title">
        <p className="auth-panel__brand">{APP_NAME}</p>
        <h1 id="auth-status-title">確認中</h1>
        <p className="auth-panel__summary">
          認証状態を確認しています。少しだけお待ちください。
        </p>
      </section>
    </main>
  );
}

export function LoginRoute() {
  const { isAuthenticated, isAuthReady, isLoginInProgress } = useAppAuth();

  if (!isAuthReady || isLoginInProgress) {
    return <AuthStatusPage />;
  }

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  return <LoginPage />;
}

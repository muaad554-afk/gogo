import AuthForm from "../components/AuthForm";

export default function Login() {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      <AuthForm mode="login" />
    </div>
  );
}

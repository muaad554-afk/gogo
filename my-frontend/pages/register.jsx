import AuthForm from "../components/AuthForm";

export default function Register() {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      <AuthForm mode="register" />
    </div>
  );
}

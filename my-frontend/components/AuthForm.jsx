import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function AuthForm({ mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "login") {
      await login(email, password);
    } else {
      await register(email, password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-dark p-6 rounded shadow-md">
      <input
        type="email"
        placeholder="Email"
        className="input mb-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="input mb-4"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="btn w-full">{mode === "login" ? "Login" : "Register"}</button>
    </form>
  );
}


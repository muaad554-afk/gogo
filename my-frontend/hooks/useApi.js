import axios from "axios";
import { useAuth } from "./useAuth";

export const useApi = () => {
  const { token } = useAuth();

  const instance = axios.create({
    baseURL: "/api",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return {
    get: (url) => instance.get(url).then((res) => res.data),
    post: (url, data) => instance.post(url, data).then((res) => res.data),
  };
};

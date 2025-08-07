import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

export default function RefundList() {
  const [refunds, setRefunds] = useState([]);
  const { get } = useApi();

  useEffect(() => {
    get("/refunds").then(setRefunds);
  }, []);

  return (
    <div className="p-6 text-white">
      <h2 className="text-xl font-bold mb-4">Refund Requests</h2>
      <ul>
        {refunds.map((r) => (
          <li key={r.id} className="mb-2 border p-2 rounded">
            {r.email} - ${r.amount} - {r.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

import React from "react";
import { useAuth } from "../AuthContext";
import Layout from "./Layout";

export default function OwnerRoute({ children }) {
  const { admin } = useAuth();

  if (admin?.role !== "owner") {
    return (
      <Layout>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-lg font-semibold mb-2">Owner access only</p>
          <p className="text-sm" style={{ color: "#6B6960" }}>
            This section is only available to owner accounts. Ask an owner to check this for you.
          </p>
        </div>
      </Layout>
    );
  }

  return children;
}

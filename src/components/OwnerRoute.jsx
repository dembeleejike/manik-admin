import React from "react";
import { useAuth } from "../AuthContext";
import Layout from "./Layout";

export default function OwnerRoute({ children }) {
  const { admin } = useAuth();

  if (!admin?.isOwner) {
    return (
      <Layout>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-lg font-semibold mb-2">Admin access only</p>
          <p className="text-sm" style={{ color: "#6B6960" }}>
            This section is only available to admin accounts. Ask an admin to check this for you.
          </p>
        </div>
      </Layout>
    );
  }

  return children;
}

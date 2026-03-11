import { useAuth } from "@/app/context/useAuth";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/app/signin");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return null;
};

export default PrivateRoute;

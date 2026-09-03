import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import LoginForm from "../../components/auth/LoginForm";
import LoginCard from "../../components/auth/LoginCard";
import PawGuardLogo from "../../components/common/PawGuardLogo";
import { getStoredUser } from "../../utils/authStorage";
import { getDashboardPathForRole, normalizeRole } from "../../utils/roleUtils";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      const role = normalizeRole(user);
      if (role) {
        navigate(getDashboardPathForRole(role), { replace: true });
      }
    }
  }, [navigate]);

  return (
    <AuthLayout>
      <LoginCard>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <PawGuardLogo size={64} />
        </div>

        <h1 className="login-title">PawGuard</h1>

        <p className="login-subtitle">
          Sign in to your account
        </p>

        <LoginForm />
      </LoginCard>
    </AuthLayout>
  );
};

export default Login;
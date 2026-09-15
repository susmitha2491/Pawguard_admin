import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FaGlobe,
  FaHome,
  FaFileAlt,
  FaInfoCircle,
  FaStar,
  FaNewspaper,
  FaQuestionCircle,
  FaPhoneAlt,
  FaBalanceScale,
  FaExclamationTriangle,
  FaEnvelope,
} from "react-icons/fa";

const navTabs = [
  { path: "/cms/home", label: "Home", icon: <FaHome /> },
  { path: "/cms/pages", label: "Pages & Sections", icon: <FaFileAlt /> },
  { path: "/cms/about", label: "About & Mission", icon: <FaInfoCircle /> },
  { path: "/cms/success-stories", label: "Success Stories", icon: <FaStar /> },
  { path: "/cms/articles", label: "Articles & Awareness", icon: <FaNewspaper /> },
  { path: "/cms/faq", label: "FAQ Management", icon: <FaQuestionCircle /> },
  { path: "/cms/contact", label: "Contact & Hotlines", icon: <FaPhoneAlt /> },
  { path: "/cms/inquiries", label: "Contact Inquiries", icon: <FaEnvelope /> },
  { path: "/cms/legal", label: "Legal Pages", icon: <FaBalanceScale /> },
  { path: "/cms/alerts", label: "Urgent Alerts", icon: <FaExclamationTriangle /> },
];

const CmsLayout = () => {
  const location = useLocation();

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Banner */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",
          padding: "24px 28px",
          borderRadius: "16px",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <FaGlobe size={24} style={{ color: "#3B82F6" }} />
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#FFFFFF" }}>
              Website Management (CMS)
            </h1>
          </div>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: "14px", maxWidth: 680 }}>
            Manage public website content, homepage sections, success stories, articles, FAQs,
            contact hotlines, and legal documents. All draft changes sync live with the PawGuard backend.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "wrap",
          background: "#FFFFFF",
          padding: "8px",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {navTabs.map((tab) => {
          const isActive =
            location.pathname === tab.path ||
            (tab.path === "/cms/home" && location.pathname === "/cms");

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px",
                fontSize: "13.5px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "all 0.2s ease-in-out",
                background: isActive ? "#2563EB" : "transparent",
                color: isActive ? "#FFFFFF" : "#64748B",
              }}
            >
              <span style={{ fontSize: "14px" }}>{tab.icon}</span>
              {tab.label}
            </NavLink>
          );
        })}
      </div>

      {/* Tab Content View */}
      <div>
        <Outlet />
      </div>
    </div>
  );
};

export default CmsLayout;

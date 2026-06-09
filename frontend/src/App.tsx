import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  Content,
  Theme,
} from "@carbon/react";
import Onboarding from "./pages/Onboarding";
import FileManager from "./pages/FileManager";
import Chat from "./pages/Chat";
import MindMap from "./pages/MindMap";
import Skills from "./pages/Skills";
import Settings from "./pages/Settings";

const NAV = [
  { label: "Home", path: "/onboarding" },
  { label: "Documents", path: "/files" },
  { label: "Chat", path: "/chat" },
  { label: "Mind Map", path: "/mindmap" },
  { label: "Skills", path: "/skills" },
  { label: "Settings", path: "/settings" },
];

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <Theme theme="white">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header aria-label="CuriousAI">
        <HeaderName href="#" prefix="" onClick={(e: any) => { e.preventDefault(); navigate("/"); }}>
          <span className="brand-curious">Curious<span className="accent">AI</span></span>
        </HeaderName>
        <HeaderNavigation aria-label="Primary">
          {NAV.map((n) => (
            <HeaderMenuItem
              key={n.path}
              isActive={pathname.startsWith(n.path)}
              onClick={() => navigate(n.path)}
            >
              {n.label}
            </HeaderMenuItem>
          ))}
        </HeaderNavigation>
      </Header>

      <Content id="main-content" className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/files" element={<FileManager />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/mindmap" element={<MindMap />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Content>
    </Theme>
  );
}

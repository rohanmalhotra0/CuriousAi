import { Content, Header, HeaderName, HeaderNavigation, HeaderMenuItem } from "@carbon/react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { HomePage } from "./pages/Home";
import { FilesPage } from "./pages/Files";
import { ChatPage } from "./pages/Chat";

const NAV = [
  { label: "Home", to: "/" },
  { label: "Files", to: "/files" },
  { label: "Chat", to: "/chat" },
];

export function App() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <Header aria-label="CuriousAI">
        <HeaderName as={Link} to="/" prefix="">
          <span className="brand-curious">
            Curious<span className="accent">AI</span>
          </span>
        </HeaderName>
        <HeaderNavigation aria-label="CuriousAI">
          {NAV.map((n) => (
            <HeaderMenuItem
              key={n.to}
              isActive={
                n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)
              }
              onClick={() => navigate(n.to)}
            >
              {n.label}
            </HeaderMenuItem>
          ))}
        </HeaderNavigation>
      </Header>

      <Content className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:chatId" element={<ChatPage />} />
        </Routes>
      </Content>
    </>
  );
}

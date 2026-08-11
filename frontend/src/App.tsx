import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Chantiers from "./pages/Chantiers";
import ChantierDetail from "./pages/ChantierDetail";
import PieceDetail from "./pages/PieceDetail";
import Referentiel from "./pages/Referentiel";
import Regles from "./pages/Regles";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Chantiers />} />
        <Route path="/chantier/:id" element={<ChantierDetail />} />
        <Route path="/piece/:id" element={<PieceDetail />} />
        <Route path="/referentiel" element={<Referentiel />} />
        <Route path="/regles" element={<Regles />} />
      </Route>
    </Routes>
  );
}

import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingSkeleton } from "./components/feedback/LoadingSkeleton";
import { AppShell } from "./components/layout/AppShell";

const DashboardPage = lazy(() =>
  import("./features/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const QuizPage = lazy(() =>
  import("./features/quiz/QuizPage").then((module) => ({ default: module.QuizPage })),
);
const StudyPage = lazy(() =>
  import("./features/study/StudyPage").then((module) => ({ default: module.StudyPage })),
);
const LabPage = lazy(() =>
  import("./features/lab/LabPage").then((module) => ({ default: module.LabPage })),
);
const CareerPage = lazy(() =>
  import("./features/career/CareerPage").then((module) => ({ default: module.CareerPage })),
);
const WikiPage = lazy(() =>
  import("./features/wiki/WikiPage").then((module) => ({ default: module.WikiPage })),
);

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingSkeleton className="h-[70vh]" />}>
        <Routes>
          <Route element={<DashboardPage />} path="/" />
          <Route element={<StudyPage />} path="/study" />
          <Route element={<LabPage />} path="/lab" />
          <Route element={<CareerPage />} path="/career" />
          <Route element={<QuizPage />} path="/quiz" />
          <Route element={<WikiPage />} path="/wiki" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

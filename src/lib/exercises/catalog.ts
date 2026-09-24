import type { ExerciseDifficulty, ExerciseTopicSlug } from "@/types";

export const GRADE_4 = 4 as const;

export const DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  easy: "Łatwy",
  medium: "Średni",
  hard: "Trudny",
};

export interface Grade4ExerciseTopic {
  slug: ExerciseTopicSlug;
  label: string;
  guidance: Record<ExerciseDifficulty, string>;
}

export const GRADE_4_EXERCISE_CATALOG: readonly Grade4ExerciseTopic[] = [
  {
    slug: "addition-subtraction",
    label: "Dodawanie i odejmowanie liczb naturalnych",
    guidance: {
      easy: "Jedno działanie na liczbach naturalnych do 100, bez przekraczania progu dziesiątkowego.",
      medium: "Jedno działanie pisemne na liczbach naturalnych do 10 000, z przekraczaniem progów dziesiątkowych.",
      hard: "Dwa kolejne działania dodawania lub odejmowania na liczbach naturalnych do 1 000 000.",
    },
  },
  {
    slug: "multiplication-division",
    label: "Mnożenie i dzielenie liczb naturalnych",
    guidance: {
      easy: "Jedno mnożenie lub dzielenie w zakresie tabliczki mnożenia do 100; dzielenie bez reszty.",
      medium: "Mnożenie liczby najwyżej trzycyfrowej przez jednocyfrową albo odpowiadające mu dzielenie bez reszty.",
      hard: "Mnożenie dwóch liczb co najmniej dwucyfrowych albo dzielenie liczby wielocyfrowej przez jednocyfrową bez reszty.",
    },
  },
  {
    slug: "order-of-operations",
    label: "Kolejność wykonywania działań",
    guidance: {
      easy: "Wyrażenie z dwoma działaniami na liczbach naturalnych do 100, wymagające pierwszeństwa mnożenia lub dzielenia.",
      medium: "Wyrażenie z trzema działaniami na liczbach naturalnych do 1 000 i jedną parą nawiasów.",
      hard: "Wyrażenie z co najmniej czterema działaniami na liczbach naturalnych do 10 000 i dwiema parami nawiasów.",
    },
  },
  {
    slug: "word-problems",
    label: "Zadania tekstowe na liczbach naturalnych",
    guidance: {
      easy: "Krótki kontekst życia codziennego wymagający jednego dodawania albo odejmowania liczb naturalnych do 100.",
      medium: "Kontekst życia codziennego wymagający dwóch kolejnych działań na liczbach naturalnych do 1 000.",
      hard: "Wieloetapowy kontekst życia codziennego wymagający samodzielnego doboru co najmniej trzech działań na liczbach naturalnych.",
    },
  },
];

# Frame Brief: Gwarancja zatwierdzenia a niezależne testy

> Framing przed /10x-plan. Porównanie kontraktów, nie wybór implementacji.
> Data: 2026-10-15. Zakres: FR-006 i ryzyko #3; ryzyko #5 poza zakresem.

## Reported Observation

Porównaj dwa warianty: (A) wprowadzenie autorytatywnego źródła i egzekwowanie go przed zatwierdzeniem ćwiczenia w runtime; (B) niezależny zestaw testowy przy pozostawieniu probabilistycznej weryfikacji runtime. Wyjaśnij różnicę w gwarancjach i konsekwencje dla PRD FR-006 oraz ryzyka #3.

To pytanie o zakres i kontrakt, nie zgłoszenie zaobserwowanego błędu.

## Initial Framing (preserved)

- **User's stated cause or approach**: „(A) wprowadzenie autorytatywnego źródła i egzekwowanie go przed zatwierdzeniem ćwiczenia w runtime; (B) niezależny zestaw testowy przy pozostawieniu probabilistycznej weryfikacji runtime.”
- **User's proposed direction**: „Nie zakładaj wyboru; pomóż mi podjąć decyzję przed planowaniem. Nie rozszerzaj zakresu o ryzyko #5.”
- **Pre-dispatch narrowing — obietnica**: „Jako warunek dla każdego ćwiczenia pokazanego uczniowi, nie tylko cel jakościowy”.
- **Pre-dispatch narrowing — zakres**: „Wystarczy wybrany, jawnie ograniczony podzbiór tematów i form zadań”.
- **Stan początkowy**: A/B było nierozstrzygnięte. Tytuł istniejącej zmiany nie stanowił potwierdzenia wyboru A.

## Dimension Map

1. **Dowód dla konkretnego ćwiczenia i dopuszczenie runtime** — wariant A;
   pochodzenie zapisu nie jest dowodem poprawności ani jednoznaczności.
2. **Niezależność i zakres dowodu testowego** — wariant B;
   poprawne wyniki na korpusie nie certyfikują dowolnego nowego ćwiczenia.

FR-006 i guardraile określają kryterium oceny obu wymiarów, nie trzecią
hipotezę techniczną. Nie zakładamy, że dwa modele popełniają niezależne błędy.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Obecny sukces runtime opiera się na zgodności modelu, nie autorytatywnym dowodzie. | [Verifier:120](../../../src/lib/services/openrouter-exercise-verifier.ts:120): singleton po normalizacji musi zgadzać się z propozycją. [Approval:101](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:101): właściciel i `unique_answer` wystarczają do promocji. | STRONG |
| Związanie dowodu z treścią chroni przed podmianą, ale nie dowodzi prawdziwości. | [Snapshot:106](../../../src/pages/api/exercises/verify.ts:106), [porównanie:149](../../../src/pages/api/exercises/verify.ts:149), [kopiowanie:136](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:136). | STRONG |
| Obecne testy badają kontrakty na dostarczonych wynikach, nie niezależne rozwiązanie treści. | [Stub odpowiedzi:25](../../../src/lib/services/openrouter-exercise-verifier.test.ts:25), [klasyfikacja:129](../../../src/lib/services/openrouter-exercise-verifier.test.ts:129), [injected verifier:84](../../../src/pages/api/exercises/verify.test.ts:84), [kopiowanie w pgTAP:625](../../../supabase/tests/database/exercise_verification_approval.sql:625). | STRONG |
| B samo spełni obecne kryterium ochrony ryzyka #3. | [Test plan, Risk Response Guidance](../../foundation/test-plan.md#risk-response-guidance) wymaga autorytatywnego dowodu przy zatwierdzeniu. Korpus offline nie dodaje tego warunku do runtime. | NONE |

STRONG opisuje siłę dowodu dla danej tezy, nie poziom bezpieczeństwa produktu.
Nie wykonano reprodukcji, testów ani wywołań modeli. Ścieżka fałszywej
akceptacji jest wnioskiem z kodu; nie ustalono incydentu ani jego częstości.

## Narrowing Signals

- Użytkownik wymaga warunku dla każdego ćwiczenia, nie wyłącznie dobrego wyniku na próbie.
- Jawne ograniczenie domeny jest dopuszczalne; zachowanie wszystkich swobodnych zadań tekstowych nie jest ustaloną koniecznością.
- Rola nauczyciela: „Przegląd treści i przydatności; platforma ma wcześniej ustalić poprawność i jednoznaczność”.
- Zatwierdzenie nauczyciela nie może więc być domyślnie traktowane jako niezależny dowód matematyczny.
- **Po porównaniu wariantów**: „Tak — utrzymuję warunek dla każdego ćwiczenia i akceptuję ograniczony zakres”. Użytkownik świadomie podtrzymał silniejszy kontrakt po przedstawieniu kosztu ograniczenia zakresu.

## Cross-System Convention

Dowód offline i warunek dopuszczenia runtime mają różne kwantyfikatory:
„sprawdzone przypadki” kontra „każdy dopuszczony przypadek”. To rozróżnienie
kontraktów, nie zewnętrzny benchmark ani oszacowanie niezawodności modelu.

Pressure-test historii: [wcześniejszy brief, Open Risks & Assumptions](../../archive/2026-09-29-approve-first-exercise-pool/plan-brief.md#open-risks--assumptions)
jawnie pozostawiał probabilistyczny verifier i końcowy przegląd nauczyciela.
To wyjaśnia obecny projekt, ale nie spełnia nowo doprecyzowanej interpretacji.
[PRD](../../foundation/prd.md#guardrails) wymaga jednej poprawnej odpowiedzi;
[FR-006](../../foundation/prd.md#exercise-preparation) rozdziela weryfikację platformy i zatwierdzenie nauczyciela.

Sprawdzenie granic A: samo wzmocnienie RPC nie wystarczy do uniwersalnej
obietnicy, jeśli inne ścieżki dopuszczają treść bez tego dowodu.
[Nullable provenance:43](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:43),
[saved retrieval:49](../../../supabase/migrations/20261002120000_add_saved_exercise_discovery.sql:49)
i [assignment eligibility:332](../../../supabase/migrations/20261009083500_make_homework_assignment_retries_membership_stable.sql:332)
pokazują tę granicę. [Reset:1](../../../supabase/migrations/20260930120000_reset_exercise_data_for_answer_equivalence_v2.sql:1)
usunął wcześniejsze dane; nie ustalono istnienia legacy rows na wdrożeniu.

## Porównanie wariantów

| Kwestia | A: źródło egzekwowane runtime | B: niezależny korpus, probabilistyczny runtime |
| --- | --- | --- |
| Jednostka dowodu | Konkretne ćwiczenie dopuszczane do puli, w deklarowanej domenie. | Przypadki objęte korpusem; wykrywanie znanych błędów i regresji. |
| Warunki wiarygodności | Poprawne źródło, dowód poprawności i jednoznaczności, związanie z dokładną treścią i pełne egzekwowanie. | Oczekiwane rozwiązania i ocena jednoznaczności ustalone niezależnie od testowanej implementacji i zgadzających się modeli. |
| Treść bez wystarczającego dowodu | Niedopuszczona w ramach deklarowanej gwarancji. | Może nadal przejść ocenę modelu; obecna bramka nie wymaga dowodu z korpusu. |
| FR-006 i guardrail | Zgodny kierunek dla wskazanej interpretacji, warunkowo; nazwa „autorytatywne” nie daje bezbłędności. | Sam nie uzasadnia warunku dla każdego ćwiczenia. Zachowanie B jako rozwiązania docelowego wymaga jawnego słabszego kontraktu lub innego dowodu per ćwiczenie, co wykracza poza B. |
| Ryzyko #3 | Odpowiada obecnemu kryterium ochrony; pozostają błędy źródła, semantyki treści i egzekwowania. | Zmniejsza niewiedzę i wykrywa znane regresje, ale nie zamyka obecnego kryterium ochrony. |
| Konsekwencja produktowa | Możliwe ograniczenie form i tematów do zakresu, który źródło rzeczywiście uzasadnia. | Zachowana swoboda obecnej generacji, ale pozostaje ryzyko fałszywej akceptacji. |

Korpus ze stubowanym fetch mierzy zachowanie lokalnej interpretacji, nie
błąd wdrożonego modelu. Nawet ocena na rzeczywistym modelu byłaby pomiarem
na określonej próbie, wersji i konfiguracji, nie dowodem dla każdej przyszłej treści.
Nie wyznaczono progu, wielkości próby ani częstości błędów.

Testy niezależne są wartościowe także w A; ich obecność nie odróżnia wariantów.
Różnicą jest obowiązek autorytatywnego dowodu przed dopuszczeniem.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: ustalić, czy zatwierdzenie ma wymagać dowodu poprawności i jednoznaczności dla każdego ćwiczenia w ograniczonej domenie, czy produkt świadomie przyjmuje probabilistyczną ocenę wspartą testami.

Początkowe rozróżnienie A/B było trafne. Przy zachowaniu zadeklarowanej
obietnicy B nie jest równoważnym rozwiązaniem: testy nie zastępują warunku
runtime. Po porównaniu użytkownik podtrzymał tę obietnicę i zaakceptował
ograniczony zakres, co potwierdza A jako zgodny kierunek; B może uzupełniać
go testami. Nie wybrano źródła ani konkretnej domeny. Nie zmieniono PRD,
strategii testów ani statusu rollout Phase 2.

## Confidence

**HIGH** dla rozróżnienia gwarancji i niezgodności samego B z podaną
interpretacją. Dowody z kodu, historia i odpowiedzi użytkownika są spójne.
Nie oznacza to certyfikacji A: wykonalność konkretnego źródła, zakres
obsługi i stan wdrożonych danych pozostają niezweryfikowane.

## What Changes for /10x-plan

Kontrakt został potwierdzony: utrzymać warunek dla każdego ćwiczenia,
akceptując ograniczony zakres. Planowanie ma dotyczyć A; pozostaje ustalenie
źródła i domeny, które rzeczywiście uzasadnią ten warunek. Niezależne testy
nie zastępują bramki runtime. Nie projektować rozwiązań ryzyka #5 w tej zmianie.

## References

- Related research: [research.md](./research.md).
- Product requirements: [prd.md](../../foundation/prd.md).
- Risk #3 criterion: [test-plan.md](../../foundation/test-plan.md#risk-response-guidance).
- Investigation tasks: `runtime-authority` (general-purpose), `independent-test-corpus` (explore), synchroniczne zadania z tego framingu.
- Nie znaleziono `context/foundation/lessons.md`; nie użyto nieudokumentowanych lekcji jako dowodu.

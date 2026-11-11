// Shown wherever press freedom scores from different years are compared.
// RSF changed its methodology in 2022, so the dashboard never calculates a
// press freedom change across 2021→2022 (see the about-the-data page).
export default function MethodologyNote() {
  return (
    <p className="methodology-note">
      <strong>Note:</strong> Reporters Without Borders changed its press freedom methodology in 2022,
      so scores from 2021 and earlier aren’t directly comparable with 2022 onwards. Changes are
      never calculated across that break.
    </p>
  )
}

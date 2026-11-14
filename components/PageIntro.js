export default function PageIntro({ title, description, className = '' }) {
  return (
    <header className={`page-intro appear-up ${className}`.trim()}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}

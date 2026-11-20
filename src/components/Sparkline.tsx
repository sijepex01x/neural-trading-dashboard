interface SparklineProps {
  values: number[];
  up?: boolean;
  className?: string;
}

export default function Sparkline({ values, up = true, className = 'spark' }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${38 - ((v - min) / span) * 32}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 42" preserveAspectRatio="none" className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={up ? '#52d6bd' : '#f0a64a'}
        strokeWidth="1.7"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

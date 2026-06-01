export default function Spinner() {
  return (
    <div className="flex items-center justify-center p-sm">
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}


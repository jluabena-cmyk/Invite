import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Login() {
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/telemetry', {
        headers: { 'X-Admin-Token': tokenInput },
      });

      if (res.ok) {
        setToken(tokenInput);
      } else {
        setError('Invalid token');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-mono text-primary font-bold tracking-tight">OWMO_DIAGNOSTICS</h1>
          <p className="text-sm text-muted-foreground font-mono">AUTHORIZED PERSONNEL ONLY</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter admin token..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="text-center bg-black/50"
              autoFocus
            />
          </div>
          
          {error && (
            <div className="text-destructive text-sm text-center font-mono bg-destructive/10 py-2 border border-destructive/20">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={!tokenInput || loading}
          >
            {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
          </Button>
        </form>
      </div>
    </div>
  );
}

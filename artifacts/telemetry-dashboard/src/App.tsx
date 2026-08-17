import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';

const queryClient = new QueryClient();

function ProtectedRoute() {
  const { token } = useAuth();
  
  if (!token) {
    return <Login />;
  }

  return <Dashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProtectedRoute} />
      <Route component={() => (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-mono">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-destructive">404</h1>
            <p className="text-muted-foreground uppercase">Sector not found</p>
          </div>
        </div>
      )} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

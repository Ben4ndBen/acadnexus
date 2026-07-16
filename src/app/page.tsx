'use client'

import { loginAction } from './actions/auth';
import { useRouter } from 'next/navigation';

export default function LoginPortal() {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    try {
      const { role } = await loginAction(formData);
      router.push(`/dashboard/${role.toLowerCase()}`);
    } catch (e) {
      alert("Login Failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-900">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-blue-900 text-center">AcadNexus</h1>
        <p className="text-sm text-center text-blue-700 mb-6">Batanes State College</p>
        
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">BSC Student or Employee ID</label>
            <input name="institutional_id" className="w-full p-2 border rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input type="password" name="password" className="w-full p-2 border rounded" required />
          </div>
          <button className="w-full bg-yellow-500 py-2 text-white font-bold rounded">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
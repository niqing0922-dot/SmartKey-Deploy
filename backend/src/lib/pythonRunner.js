import { spawn } from 'child_process';

export function runPythonJson(scriptPath, payload, options = {}) {
  const pythonCommand = options.pythonCommand || process.env.PYTHON_PATH || 'python';

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [scriptPath], {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `Python process exited with code ${code}`
          )
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim() || '{}');
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse Python JSON output: ${error.message}\n${stdout}`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

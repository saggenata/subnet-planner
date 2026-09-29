import { useState } from 'react';
import { calculateSubnet, calculateVLSM } from './lib/subnet';
import './App.css';

function App() {
  const [mode, setMode] = useState('basic'); // 'basic' | 'vlsm'

  // --- Базовый калькулятор ---
  const [ip, setIp] = useState('192.168.1.0');
  const [mask, setMask] = useState('24');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCalculate = () => {
    try {
      setResult(calculateSubnet(ip, mask));
      setError('');
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
  };

  // --- VLSM ---
  const [parentIp, setParentIp] = useState('192.168.0.0');
  const [parentMask, setParentMask] = useState('24');
  const [requirements, setRequirements] = useState([
    { name: 'Отдел продаж', hosts: 50 },
    { name: 'Отдел IT', hosts: 20 },
    { name: 'Гостевая сеть', hosts: 10 },
  ]);
  const [vlsmResults, setVlsmResults] = useState(null);
  const [vlsmError, setVlsmError] = useState('');

  const updateRequirement = (index, field, value) => {
    const copy = [...requirements];
    copy[index][field] = value;
    setRequirements(copy);
  };

  const addRequirement = () => {
    setRequirements([...requirements, { name: `Сеть ${requirements.length + 1}`, hosts: 10 }]);
  };

  const removeRequirement = (index) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const handleVlsm = () => {
    try {
      setVlsmResults(calculateVLSM(parentIp, parentMask, requirements));
      setVlsmError('');
    } catch (e) {
      setVlsmError(e.message);
      setVlsmResults(null);
    }
  };

  return (
    <div className="app">
      <h1>Subnet Planner</h1>
      <p className="subtitle">Калькулятор подсетей и VLSM для сетевых инженеров</p>

      <div className="tabs">
        <button className={mode === 'basic' ? 'active' : ''} onClick={() => setMode('basic')}>
          Базовый расчёт
        </button>
        <button className={mode === 'vlsm' ? 'active' : ''} onClick={() => setMode('vlsm')}>
          VLSM
        </button>
      </div>

      {mode === 'basic' && (
        <div className="panel">
          <div className="inputs">
            <label>
              IP-адрес
              <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.0" />
            </label>
            <label>
              Маска (CIDR или 255.255.255.0)
              <input value={mask} onChange={(e) => setMask(e.target.value)} placeholder="24" />
            </label>
            <button onClick={handleCalculate}>Рассчитать</button>
          </div>

          {error && <p className="error">{error}</p>}

          {result && (
            <table className="result-table">
              <tbody>
                <tr><td>Адрес сети</td><td>{result.network}/{result.cidr}</td></tr>
                <tr><td>Маска подсети</td><td>{result.mask}</td></tr>
                <tr><td>Wildcard-маска</td><td>{result.wildcard}</td></tr>
                <tr><td>Broadcast-адрес</td><td>{result.broadcast}</td></tr>
                <tr><td>Первый хост</td><td>{result.firstHost}</td></tr>
                <tr><td>Последний хост</td><td>{result.lastHost}</td></tr>
                <tr><td>Всего адресов</td><td>{result.totalHosts}</td></tr>
                <tr><td>Доступно хостов</td><td>{result.usableHosts}</td></tr>
                <tr><td>Класс сети</td><td>{result.networkClass}</td></tr>
                <tr><td>Тип адреса</td><td>{result.isPrivate ? 'Приватный' : 'Публичный'}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {mode === 'vlsm' && (
        <div className="panel">
          <div className="inputs">
            <label>
              Родительская сеть
              <input value={parentIp} onChange={(e) => setParentIp(e.target.value)} />
            </label>
            <label>
              Маска
              <input value={parentMask} onChange={(e) => setParentMask(e.target.value)} />
            </label>
          </div>

          <h3>Требуемые подсети</h3>
          {requirements.map((req, i) => (
            <div className="req-row" key={i}>
              <input
                value={req.name}
                onChange={(e) => updateRequirement(i, 'name', e.target.value)}
                placeholder="Название"
              />
              <input
                type="number"
                value={req.hosts}
                onChange={(e) => updateRequirement(i, 'hosts', e.target.value)}
                placeholder="Хостов"
              />
              <button className="remove-btn" onClick={() => removeRequirement(i)}>×</button>
            </div>
          ))}
          <button onClick={addRequirement}>+ Добавить подсеть</button>
          <br /><br />
          <button onClick={handleVlsm}>Распределить подсети</button>

          {vlsmError && <p className="error">{vlsmError}</p>}

          {vlsmResults && (
            <table className="result-table">
              <thead>
                <tr>
                  <th>Название</th><th>Сеть</th><th>Маска</th><th>Диапазон хостов</th><th>Доступно</th>
                </tr>
              </thead>
              <tbody>
                {vlsmResults.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    {r.error ? (
                      <td colSpan="4" className="error">{r.error}</td>
                    ) : (
                      <>
                        <td>{r.network}/{r.cidr}</td>
                        <td>{r.mask}</td>
                        <td>{r.firstHost} – {r.lastHost}</td>
                        <td>{r.usableHosts}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

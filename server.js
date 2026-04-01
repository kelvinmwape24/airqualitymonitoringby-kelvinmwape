// server.js - Backend server with Express and SQLite
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./environmental_data.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
        createTables();
    }
});

// Create tables
function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            temperature REAL NOT NULL,
            humidity REAL NOT NULL,
            thi_index REAL,
            comfort_level TEXT,
            health_advice TEXT,
            alert_level TEXT,
            location TEXT,
            device_id TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            alert_type TEXT,
            severity TEXT,
            message TEXT,
            temperature REAL,
            humidity REAL,
            acknowledged BOOLEAN DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('Database tables created/verified');
}

// Environmental Analysis Class
class EnvironmentalAnalyzer {
    static calculateTHI(tempC, humidity) {
        const tempF = (tempC * 9/5) + 32;
        const thi = 0.5 * (tempF + 61.0 + ((tempF - 68.0) * 1.2) + (humidity * 0.094));
        return Math.round(thi * 10) / 10;
    }

    static analyzeAirQuality(temp, humidity) {
        const thi = this.calculateTHI(temp, humidity);
        
        let alertLevel, comfortLevel, adviceList = [];
        
        // Determine alert level and comfort
        if (temp > 35 || thi > 85) {
            alertLevel = "CRITICAL";
            comfortLevel = "Extreme Discomfort";
            adviceList = [
                "🚨 CRITICAL EMERGENCY: Extreme heat conditions detected!",
                "⚠️ IMMEDIATE ACTION REQUIRED:",
                "• Move to an air-conditioned or cool environment immediately",
                "• Drink water every 15 minutes - stay hydrated",
                "• Avoid all outdoor activities",
                "• Check on elderly neighbors and family members",
                "• Watch for signs of heat exhaustion: dizziness, nausea, headache",
                "• If you feel unwell, seek medical attention immediately"
            ];
        } else if (temp > 32 || thi > 80) {
            alertLevel = "HIGH";
            comfortLevel = "Severe Discomfort";
            adviceList = [
                "⚠️ HIGH ALERT: Dangerous heat conditions",
                "• Limit outdoor activities to early morning or evening",
                "• Stay in shaded or air-conditioned areas",
                "• Drink plenty of water throughout the day",
                "• Wear light-colored, loose-fitting clothing",
                "• Use fans or air conditioning if available",
                "• Never leave children or pets in parked vehicles",
                "• Take cool showers or baths to lower body temperature"
            ];
        } else if (temp > 28 || thi > 75) {
            alertLevel = "MODERATE";
            comfortLevel = "High Discomfort";
            adviceList = [
                "⚠️ Moderate heat advisory",
                "• Stay hydrated - drink water regularly",
                "• Take breaks if working outdoors",
                "• Use ventilation or fans to improve air circulation",
                "• Wear breathable fabrics like cotton",
                "• Reduce strenuous activities during peak heat hours (11am-3pm)",
                "• Check on vulnerable individuals"
            ];
        } else if (temp > 25 || thi > 70) {
            alertLevel = "CAUTION";
            comfortLevel = "Moderate Discomfort";
            adviceList = [
                "⚠️ Caution: Warm conditions",
                "• Stay hydrated throughout the day",
                "• Take breaks in shaded areas if outdoors",
                "• Use sunscreen if exposed to direct sunlight",
                "• Maintain good ventilation indoors",
                "• Enjoy outdoor activities with proper precautions"
            ];
        } else if (temp < 10 || thi < 55) {
            alertLevel = "COLD";
            comfortLevel = "Cold Stress Risk";
            adviceList = [
                "❄️ Cold conditions detected",
                "• Dress in warm layers",
                "• Wear a hat and gloves when outdoors",
                "• Keep indoor spaces warm",
                "• Limit exposure to cold winds",
                "• Check on elderly and young children",
                "• Stay dry to prevent heat loss"
            ];
        } else {
            alertLevel = "NORMAL";
            comfortLevel = "Comfortable";
            adviceList = [
                "✅ Good environmental conditions",
                "• Perfect weather for outdoor activities",
                "• Enjoy fresh air and ventilation",
                "• Maintain regular hydration",
                "• Great time for exercise and recreation",
                "• Open windows for natural ventilation"
            ];
        }
        
        // Add humidity-specific advice
        if (humidity > 80) {
            adviceList.push("💧 Very high humidity: Risk of mold growth. Ensure good ventilation and use dehumidifiers if needed.");
        } else if (humidity > 70) {
            adviceList.push("💧 High humidity: May feel muggy. Use fans to improve comfort and prevent mold.");
        } else if (humidity < 30) {
            adviceList.push("🏜️ Low humidity: Dry air conditions. Use moisturizer, stay hydrated, and consider using a humidifier.");
        }
        
        // Add temperature-specific advice
        if (temp > 30) {
            adviceList.push(`🌡️ Temperature ${temp}°C: Risk of heat-related illnesses. Take necessary precautions.`);
        } else if (temp < 15) {
            adviceList.push(`❄️ Temperature ${temp}°C: Risk of cold stress. Dress appropriately.`);
        }
        
        // Calculate Air Quality Index (proxy)
        let aqi, aqiCategory;
        if (temp > 32 || thi > 80) {
            aqi = Math.min(300, 150 + (temp - 32) * 5);
            aqiCategory = "Unhealthy";
        } else if (temp > 28 || thi > 75) {
            aqi = Math.min(200, 100 + (temp - 28) * 3);
            aqiCategory = "Unhealthy for Sensitive Groups";
        } else if (temp > 25 || thi > 70) {
            aqi = Math.min(150, 50 + (temp - 25) * 2);
            aqiCategory = "Moderate";
        } else {
            aqi = Math.min(100, 25 + temp * 1.5);
            aqiCategory = "Good";
        }
        
        aqi = Math.round(aqi);
        
        return {
            thi,
            comfortLevel,
            alertLevel,
            healthAdvice: adviceList.join(' '),
            adviceList,
            aqi,
            aqiCategory,
            temperatureStatus: temp > 28 ? 'High' : (temp < 15 ? 'Low' : 'Normal'),
            humidityStatus: humidity > 70 ? 'High' : (humidity < 30 ? 'Low' : 'Normal')
        };
    }
}

// API Routes

// Submit sensor reading
app.post('/api/readings', (req, res) => {
    const { temperature, humidity, location, device_id } = req.body;
    
    if (!temperature || !humidity) {
        return res.status(400).json({ error: 'Temperature and humidity are required' });
    }
    
    const analysis = EnvironmentalAnalyzer.analyzeAirQuality(temperature, humidity);
    
    const query = `
        INSERT INTO sensor_readings (temperature, humidity, thi_index, comfort_level, health_advice, alert_level, location, device_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [temperature, humidity, analysis.thi, analysis.comfortLevel, analysis.healthAdvice, analysis.alertLevel, location || 'Unknown', device_id || 'ESP32_001'], function(err) {
        if (err) {
            console.error('Error saving reading:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Create alert if needed
        if (analysis.alertLevel !== 'NORMAL') {
            const alertQuery = `
                INSERT INTO alerts (alert_type, severity, message, temperature, humidity)
                VALUES (?, ?, ?, ?, ?)
            `;
            db.run(alertQuery, ['Environmental Alert', analysis.alertLevel, analysis.healthAdvice, temperature, humidity]);
        }
        
        res.json({
            success: true,
            id: this.lastID,
            analysis,
            message: 'Reading saved successfully'
        });
    });
});

// Get latest reading
app.get('/api/readings/latest', (req, res) => {
    db.get('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1', (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(row || {});
    });
});

// Get all readings with pagination
app.get('/api/readings', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    db.all('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Get statistics
app.get('/api/statistics', (req, res) => {
    const queries = {
        total: 'SELECT COUNT(*) as count FROM sensor_readings',
        avgTemp: 'SELECT AVG(temperature) as avg_temp FROM sensor_readings',
        maxTemp: 'SELECT MAX(temperature) as max_temp FROM sensor_readings',
        minTemp: 'SELECT MIN(temperature) as min_temp FROM sensor_readings',
        avgHumidity: 'SELECT AVG(humidity) as avg_hum FROM sensor_readings',
        alertCount: 'SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0',
        criticalAlerts: 'SELECT COUNT(*) as count FROM alerts WHERE severity = "CRITICAL" AND acknowledged = 0'
    };
    
    Promise.all(Object.values(queries).map(q => new Promise((resolve, reject) => {
        db.get(q, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    }))).then(results => {
        res.json({
            totalReadings: results[0].count,
            avgTemperature: Math.round(results[1].avg_temp * 10) / 10 || 0,
            maxTemperature: results[2].max_temp || 0,
            minTemperature: results[3].min_temp || 0,
            avgHumidity: Math.round(results[4].avg_hum * 10) / 10 || 0,
            activeAlerts: results[5].count,
            criticalAlerts: results[6].count
        });
    }).catch(err => {
        console.error('Error getting statistics:', err);
        res.status(500).json({ error: 'Database error' });
    });
});

// Get alerts
app.get('/api/alerts', (req, res) => {
    const acknowledged = req.query.acknowledged === 'true' ? 1 : 0;
    db.all('SELECT * FROM alerts WHERE acknowledged = ? ORDER BY timestamp DESC LIMIT 50', [acknowledged], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Acknowledge alert
app.put('/api/alerts/:id/acknowledge', (req, res) => {
    db.run('UPDATE alerts SET acknowledged = 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, changes: this.changes });
    });
});

// Clear all alerts
app.delete('/api/alerts', (req, res) => {
    db.run('DELETE FROM alerts', function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, deleted: this.changes });
    });
});

// Submit feedback
app.post('/api/feedback', (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !message) {
        return res.status(400).json({ error: 'Name and message are required' });
    }
    
    db.run('INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)', [name, email || null, message], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// Generate test data
app.post('/api/test-data', (req, res) => {
    const testScenarios = [
        { temp: 36.2, hum: 68, loc: 'Lusaka CBD - Extreme Heat' },
        { temp: 33.5, hum: 72, loc: 'Kitwe Industrial Area' },
        { temp: 29.8, hum: 78, loc: 'Ndola Commercial District' },
        { temp: 26.5, hum: 55, loc: 'Lusaka Residential' },
        { temp: 31.2, hum: 82, loc: 'Kafue - High Humidity' },
        { temp: 23.5, hum: 45, loc: 'Livingstone - Pleasant' },
        { temp: 14.2, hum: 65, loc: 'Mongu - Cold Morning' },
        { temp: 34.0, hum: 60, loc: 'Chingola - Hot Conditions' }
    ];
    
    let inserted = 0;
    testScenarios.forEach(scenario => {
        const analysis = EnvironmentalAnalyzer.analyzeAirQuality(scenario.temp, scenario.hum);
        db.run(`INSERT INTO sensor_readings (temperature, humidity, thi_index, comfort_level, health_advice, alert_level, location) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [scenario.temp, scenario.hum, analysis.thi, analysis.comfortLevel, analysis.healthAdvice, analysis.alertLevel, scenario.loc],
            function() {
                inserted++;
                if (inserted === testScenarios.length) {
                    res.json({ success: true, message: `Generated ${inserted} test readings` });
                }
            });
    });
});

// Serve main HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ═══════════════════════════════════════════════════════
    🌍 Environmental Comfort & Air Quality Monitoring System
    ═══════════════════════════════════════════════════════
    Server running at: http://localhost:${PORT}
    Database: SQLite (environmental_data.db)
    API Endpoints available at /api/*
    ═══════════════════════════════════════════════════════
    `);
});
export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      textAlign: 'center',
      position: 'relative'
    }}>
      {/* Marketing Content - wrapper positioned first */}
      <div style={{
        maxWidth: '900px',
        width: '100%',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Video Button - Left aligned */}
        <a
          href="/Daedalus.mp4"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'absolute',
            top: '0px',
            left: '0px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '2px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '12px',
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span style={{ fontSize: '24px' }}>🎬</span>
          <span>Video</span>
        </a>

        {/* Documentation Button - Right aligned */}
        <a
          href="/DAEDALUS_USER_GUIDE.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '2px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '12px',
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span style={{ fontSize: '24px' }}>📖</span>
          <span>Documentation</span>
        </a>

        {/* Large Daedalus Logo */}
        <div style={{ marginBottom: '48px' }}>
          <img
            src="/daedalus.png"
            alt="Daedalus Logo"
            style={{
              width: '400px',
              height: 'auto',
              filter: 'drop-shadow(0 10px 30px rgba(59, 130, 246, 0.3))'
            }}
          />
        </div>

        <p style={{
          fontSize: '18px',
          color: '#94a3b8',
          marginBottom: '32px',
          marginTop: '64px',
          lineHeight: '1.6'
        }}>
          Next-generation financial modeling platform for navigating uncertainty with confidence. Model complex statements, test scenarios, and understand decision impacts.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: '32px',
          marginTop: '48px',
          textAlign: 'left'
        }}>
          {/* Feature 1 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🎯 Flexible & Dynamic
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Define financial statements with formulas that automatically handle dependencies and cascading effects.
            </p>
          </div>

          {/* Feature 2 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🔮 Multi-Scenario Planning
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Model unlimited scenarios with different assumptions and compare outcomes side-by-side.
            </p>
          </div>

          {/* Feature 3 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🌍 Physical Risk
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Incorporate climate risk factors by mapping hazards, locations, and damage curves.
            </p>
          </div>

          {/* Feature 4 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              ⚡ Smart Validation
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Built-in validation rules catch errors and ensure models stay consistent.
            </p>
          </div>

          {/* Feature 5 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🔄 What-if Analysis
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Model strategic interventions that trigger automatically based on conditions or time.
            </p>
          </div>

          {/* Feature 6 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              📊 Visualization
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Explore results across scenarios, time periods, and entities with interactive charts.
            </p>
          </div>

          {/* Feature 7 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🎲 Monte Carlo Analysis
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Run thousands of simulations with probabilistic inputs to understand outcome distributions.
            </p>
          </div>

          {/* Feature 8 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🌱 Transition Planning
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Model abatement pathways with marginal cost curves to plan net-zero transitions.
            </p>
          </div>

          {/* Feature 9 */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              📄 Report Writing
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Generate comprehensive reports with charts, tables, and narrative summaries of model results.
            </p>
          </div>
        </div>

        {/* Bottom tagline */}
        <div style={{
          marginTop: '64px',
          paddingTop: '32px',
          borderTop: '1px solid rgba(71, 85, 105, 0.4)'
        }}>
          <p style={{
            fontSize: '18px',
            color: '#64748b',
            fontStyle: 'italic'
          }}>
            Navigate the labyrinth of financial uncertainty with clarity and confidence.
          </p>
        </div>
      </div>
    </div>
  )
}

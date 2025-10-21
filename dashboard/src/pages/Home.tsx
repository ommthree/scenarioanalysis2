export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      textAlign: 'center'
    }}>
      {/* Large Daedalus Logo */}
      <img
        src="/daedalus.png"
        alt="Daedalus Logo"
        style={{
          width: '400px',
          height: 'auto',
          marginBottom: '48px',
          filter: 'drop-shadow(0 10px 30px rgba(59, 130, 246, 0.3))'
        }}
      />

      {/* Marketing Content */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <p style={{
          fontSize: '20px',
          color: '#94a3b8',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          Daedalus is the next-generation financial modeling platform that empowers organizations
          to navigate uncertainty with confidence. Built on a powerful scenario engine, our platform
          enables you to model complex financial statements, test multiple scenarios, and understand
          the ripple effects of every decision.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
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
              fontSize: '20px',
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
              Define your financial statements with hierarchical line items and formulas.
              Our intelligent engine automatically handles dependencies and calculates cascading effects.
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
              fontSize: '20px',
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
              Model unlimited scenarios with different driver assumptions. Compare outcomes
              side-by-side and understand the full range of possible futures.
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
              fontSize: '20px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🌍 Physical Risk Integration
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Incorporate climate and physical risk factors into your models. Map hazards,
              locations, and damage curves to understand real-world exposures.
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
              fontSize: '20px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              ⚡ Intelligent Validation
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Built-in validation rules catch errors before they propagate. Define constraints
              and business rules that ensure your models stay consistent.
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
              fontSize: '20px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              🔄 Management Actions
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Model strategic interventions that trigger based on specific conditions.
              See how proactive decisions can change your financial trajectory.
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
              fontSize: '20px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>
              📊 Powerful Visualization
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6'
            }}>
              Interactive charts and dashboards bring your data to life. Explore results
              across scenarios, time periods, and entities with intuitive visual tools.
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

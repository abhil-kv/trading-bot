#!/usr/bin/env python3
"""
Database Migration Script
Run this script to set up the PostgreSQL database for the trading bot
"""
import psycopg2
import os
import sys
from pathlib import Path


def get_db_config():
    """Get database configuration from environment or use defaults"""
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432'),
        'database': os.getenv('DB_NAME', 'trading_bot'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', '')
    }


def check_database_exists(config):
    """Check if the database exists"""
    try:
        # Connect to postgres database to check if our database exists
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database='postgres',
            user=config['user'],
            password=config['password']
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        cur.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (config['database'],)
        )
        exists = cur.fetchone() is not None
        
        cur.close()
        conn.close()
        return exists
    except Exception as e:
        print(f"Error checking database: {e}")
        return False


def create_database(config):
    """Create the database if it doesn't exist"""
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database='postgres',
            user=config['user'],
            password=config['password']
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        print(f"Creating database '{config['database']}'...")
        cur.execute(f"CREATE DATABASE {config['database']}")
        
        cur.close()
        conn.close()
        print(f"✓ Database '{config['database']}' created successfully")
        return True
    except Exception as e:
        print(f"Error creating database: {e}")
        return False


def run_schema(config):
    """Run the schema.sql file to create tables"""
    try:
        conn = psycopg2.connect(**config)
        cur = conn.cursor()
        
        # Read schema file
        schema_path = Path(__file__).parent / 'schema.sql'
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        print("Running schema.sql...")
        cur.execute(schema_sql)
        conn.commit()
        
        cur.close()
        conn.close()
        print("✓ Schema created successfully")
        return True
    except Exception as e:
        print(f"Error running schema: {e}")
        return False


def verify_tables(config):
    """Verify that all tables were created"""
    try:
        conn = psycopg2.connect(**config)
        cur = conn.cursor()
        
        expected_tables = [
            'candles',
            'mean_reversion_signals',
            'swing_signals',
            'orb_signals',
            'strategy_performance',
            'trade_journal',
            'market_conditions',
            'watchlist'
        ]
        
        print("\nVerifying tables...")
        cur.execute("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        
        tables = [row[0] for row in cur.fetchall()]
        
        missing_tables = [t for t in expected_tables if t not in tables]
        
        if missing_tables:
            print(f"✗ Missing tables: {', '.join(missing_tables)}")
            return False
        
        print(f"✓ All {len(expected_tables)} tables created successfully:")
        for table in expected_tables:
            print(f"  - {table}")
        
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error verifying tables: {e}")
        return False


def main():
    """Main migration function"""
    print("=" * 60)
    print("Trading Bot Database Migration")
    print("=" * 60)
    print()
    
    # Get configuration
    config = get_db_config()
    
    print("Database Configuration:")
    print(f"  Host: {config['host']}")
    print(f"  Port: {config['port']}")
    print(f"  Database: {config['database']}")
    print(f"  User: {config['user']}")
    print()
    
    # Check if database exists
    if not check_database_exists(config):
        print(f"Database '{config['database']}' does not exist.")
        response = input("Create it now? (y/n): ")
        if response.lower() != 'y':
            print("Migration cancelled.")
            sys.exit(0)
        
        if not create_database(config):
            print("Failed to create database.")
            sys.exit(1)
    else:
        print(f"✓ Database '{config['database']}' exists")
    
    print()
    
    # Run schema
    if not run_schema(config):
        print("Failed to run schema.")
        sys.exit(1)
    
    print()
    
    # Verify tables
    if not verify_tables(config):
        print("Table verification failed.")
        sys.exit(1)
    
    print()
    print("=" * 60)
    print("✓ Migration completed successfully!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Update your .env file with database credentials")
    print("2. Test the connection using database_service.py")
    print("3. Start inserting trading signals")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nMigration cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        sys.exit(1)

# Made with Bob

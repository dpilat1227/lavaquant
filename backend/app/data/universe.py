"""Stock universe definitions."""
from __future__ import annotations

import pandas as pd

SP500_TICKERS_SAMPLE = [
    "AAPL","MSFT","AMZN","NVDA","GOOGL","META","BRK-B","LLY","AVGO","JPM",
    "TSLA","UNH","V","XOM","MA","JNJ","PG","HD","COST","MRK",
    "ABBV","CVX","BAC","CRM","AMD","NFLX","PEP","KO","TMO","ACN",
    "LIN","MCD","CSCO","WMT","ABT","DHR","GE","CAT","QCOM","TXN",
    "INTU","AMGN","GS","RTX","IBM","SPGI","PFE","ISRG","NOW","BLK",
    "AXP","UBER","BKNG","T","SCHW","DE","SYK","MU","ADI","AMAT",
    "MDLZ","CI","REGN","VRTX","GILD","CB","MMC","PLD","ELV","BSX",
    "ZTS","CVS","NEE","SO","DUK","TJX","WM","CL","EOG","PH",
    "APH","ITW","USB","C","MCO","WELL","FDX","GM","F","GD",
    "HUM","ROP","EW","ICE","CME","NXPI","KLAC","LRCX","SNPS","CDNS",
    "SPY","QQQ","IWM","GLD","SLV","USO","XLE","XLF","XLK","XLV",
    "XLI","XLP","XLU","XLRE","XLC","XLY","XLB","VNQ","TLT","HYG",
]

FOREX_TICKERS = [
    "EURUSD=X","GBPUSD=X","USDJPY=X","USDCHF=X","AUDUSD=X",
    "USDCAD=X","NZDUSD=X","EURGBP=X","EURJPY=X","GBPJPY=X",
]

COMMODITY_TICKERS = [
    "GC=F","SI=F","CL=F","NG=F","HG=F","ZC=F","ZS=F","ZW=F",
    "GLD","SLV","USO","UNG","PDBC","DBA",
]

UNIVERSES = {
    "sp500": SP500_TICKERS_SAMPLE,
    "etfs": [t for t in SP500_TICKERS_SAMPLE if t in {"SPY","QQQ","IWM","GLD","SLV","USO","XLE","XLF","XLK","XLV","XLI","XLP","XLU","XLRE","XLC","XLY","XLB","VNQ","TLT","HYG"}],
    "forex": FOREX_TICKERS,
    "commodities": COMMODITY_TICKERS,
    "sp500_etfs": SP500_TICKERS_SAMPLE,
}

SECTOR_MAP = {
    "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology",
    "GOOGL": "Technology", "META": "Technology", "AVGO": "Technology",
    "AMD": "Technology", "QCOM": "Technology", "TXN": "Technology",
    "INTU": "Technology", "CSCO": "Technology", "CRM": "Technology",
    "NOW": "Technology", "ADI": "Technology", "AMAT": "Technology",
    "MU": "Technology", "NXPI": "Technology", "KLAC": "Technology",
    "LRCX": "Technology", "SNPS": "Technology", "CDNS": "Technology",
    "AMZN": "Consumer Discretionary", "TSLA": "Consumer Discretionary",
    "HD": "Consumer Discretionary", "MCD": "Consumer Discretionary",
    "TJX": "Consumer Discretionary", "BKNG": "Consumer Discretionary",
    "UBER": "Consumer Discretionary", "GM": "Consumer Discretionary",
    "F": "Consumer Discretionary",
    "JPM": "Financials", "BAC": "Financials", "GS": "Financials",
    "MS": "Financials", "BLK": "Financials", "SCHW": "Financials",
    "AXP": "Financials", "USB": "Financials", "C": "Financials",
    "MCO": "Financials", "SPGI": "Financials", "CME": "Financials",
    "ICE": "Financials", "MMC": "Financials", "CB": "Financials",
    "V": "Financials", "MA": "Financials",
    "UNH": "Healthcare", "JNJ": "Healthcare", "LLY": "Healthcare",
    "MRK": "Healthcare", "ABBV": "Healthcare", "TMO": "Healthcare",
    "ABT": "Healthcare", "DHR": "Healthcare", "AMGN": "Healthcare",
    "PFE": "Healthcare", "ISRG": "Healthcare", "REGN": "Healthcare",
    "VRTX": "Healthcare", "GILD": "Healthcare", "CI": "Healthcare",
    "CVS": "Healthcare", "HUM": "Healthcare", "EW": "Healthcare",
    "BSX": "Healthcare", "SYK": "Healthcare", "ZTS": "Healthcare",
    "XOM": "Energy", "CVX": "Energy", "EOG": "Energy",
    "BRK-B": "Financials",
    "PG": "Consumer Staples", "KO": "Consumer Staples",
    "PEP": "Consumer Staples", "COST": "Consumer Staples",
    "WMT": "Consumer Staples", "MDLZ": "Consumer Staples", "CL": "Consumer Staples",
    "LIN": "Materials",
    "CAT": "Industrials", "GE": "Industrials", "RTX": "Industrials",
    "DE": "Industrials", "ITW": "Industrials", "PH": "Industrials",
    "GD": "Industrials", "FDX": "Industrials", "WM": "Industrials",
    "ROP": "Industrials", "APH": "Industrials",
    "NEE": "Utilities", "SO": "Utilities", "DUK": "Utilities",
    "PLD": "Real Estate", "WELL": "Real Estate", "VNQ": "Real Estate",
    "T": "Communication Services",
    "ACN": "Technology", "IBM": "Technology",
}

def get_universe(name: str) -> list[str]:
    return UNIVERSES.get(name, UNIVERSES["sp500"])

def get_sector(ticker: str) -> str:
    return SECTOR_MAP.get(ticker, "Unknown")

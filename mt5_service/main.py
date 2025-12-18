"""
MT5 Trading Service for Exness
Main service that handles MT5 connections and trading operations
"""

import os
import sys
import json
import logging
from typing import Dict, Any, Optional, List
from flask import Flask, request, jsonify  # pyright: ignore[reportMissingImports]
from flask_cors import CORS  # pyright: ignore[reportMissingModuleSource]
from datetime import datetime
import MetaTrader5 as mt5  # pyright: ignore[reportMissingImports]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Store active connections
active_connections: Dict[str, Dict[str, Any]] = {}

class MT5Service:
    """MT5 Trading Service"""
    
    def __init__(self):
        self.connections: Dict[str, Dict[str, Any]] = {}
    
    def initialize_mt5(self) -> bool:
        """Initialize MT5 terminal"""
        if not mt5.initialize():
            logger.error(f"MT5 initialization failed: {mt5.last_error()}")
            return False
        logger.info("MT5 initialized successfully")
        return True
    
    def login(self, login: int, password: str, server: str) -> Dict[str, Any]:
        """Login to MT5 account"""
        try:
            if not mt5.initialize():
                return {
                    "success": False,
                    "error": f"MT5 initialization failed: {mt5.last_error()}"
                }
            
            authorized = mt5.login(login=int(login), password=password, server=server)
            
            if not authorized:
                error = mt5.last_error()
                mt5.shutdown()
                return {
                    "success": False,
                    "error": f"Login failed: {error}"
                }
            
            # Get account info
            account_info = mt5.account_info()
            if account_info is None:
                return {
                    "success": False,
                    "error": "Failed to get account info"
                }
            
            connection_id = f"{login}_{server}"
            self.connections[connection_id] = {
                "login": login,
                "server": server,
                "connected_at": datetime.now().isoformat(),
                "account_info": {
                    "balance": account_info.balance,
                    "equity": account_info.equity,
                    "margin": account_info.margin,
                    "free_margin": account_info.margin_free,
                    "margin_level": account_info.margin_level,
                    "currency": account_info.currency,
                    "leverage": account_info.leverage,
                }
            }
            
            return {
                "success": True,
                "connection_id": connection_id,
                "account": {
                    "balance": account_info.balance,
                    "equity": account_info.equity,
                    "margin": account_info.margin,
                    "free_margin": account_info.margin_free,
                    "margin_level": account_info.margin_level,
                    "currency": account_info.currency,
                    "leverage": account_info.leverage,
                }
            }
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def disconnect(self, connection_id: str) -> Dict[str, Any]:
        """Disconnect from MT5 account"""
        try:
            if connection_id in self.connections:
                mt5.shutdown()
                del self.connections[connection_id]
                return {"success": True}
            return {"success": False, "error": "Connection not found"}
        except Exception as e:
            logger.error(f"Disconnect error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_account_info(self, connection_id: str) -> Dict[str, Any]:
        """Get account information"""
        try:
            if connection_id not in self.connections:
                return {"success": False, "error": "Not connected"}
            
            account_info = mt5.account_info()
            if account_info is None:
                return {"success": False, "error": "Failed to get account info"}
            
            return {
                "success": True,
                "account": {
                    "balance": account_info.balance,
                    "equity": account_info.equity,
                    "margin": account_info.margin,
                    "free_margin": account_info.margin_free,
                    "margin_level": account_info.margin_level,
                    "currency": account_info.currency,
                    "leverage": account_info.leverage,
                }
            }
        except Exception as e:
            logger.error(f"Get account info error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def place_order(
        self,
        connection_id: str,
        symbol: str,
        order_type: str,
        volume: float,
        price: Optional[float] = None,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
        magic: int = 2025,
        comment: str = "SIGNALIST Bot"
    ) -> Dict[str, Any]:
        """Place a trading order"""
        try:
            if connection_id not in self.connections:
                return {"success": False, "error": "Not connected"}
            
            # Get symbol info
            symbol_info = mt5.symbol_info(symbol)
            if symbol_info is None:
                return {"success": False, "error": f"Symbol {symbol} not found"}
            
            if not symbol_info.visible:
                if not mt5.symbol_select(symbol, True):
                    return {"success": False, "error": f"Failed to select symbol {symbol}"}
            
            # Get current price
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                return {"success": False, "error": f"Failed to get tick for {symbol}"}
            
            # Determine order type
            if order_type.upper() == "BUY":
                order_type_mt5 = mt5.ORDER_TYPE_BUY
                price_exec = tick.ask if price is None else price
            elif order_type.upper() == "SELL":
                order_type_mt5 = mt5.ORDER_TYPE_SELL
                price_exec = tick.bid if price is None else price
            else:
                return {"success": False, "error": "Invalid order type. Use BUY or SELL"}
            
            # Prepare order request
            request_dict = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": volume,
                "type": order_type_mt5,
                "price": price_exec,
                "deviation": 20,
                "magic": magic,
                "comment": comment,
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            # Add SL and TP if provided
            if sl is not None:
                request_dict["sl"] = sl
            if tp is not None:
                request_dict["tp"] = tp
            
            # Send order
            result = mt5.order_send(request_dict)
            
            if result is None:
                return {"success": False, "error": "Order send failed"}
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    "success": False,
                    "error": f"Order failed: {result.retcode} - {result.comment}"
                }
            
            return {
                "success": True,
                "order": {
                    "order_id": result.order,
                    "deal_id": result.deal,
                    "volume": result.volume,
                    "price": result.price,
                    "comment": result.comment,
                    "retcode": result.retcode,
                }
            }
        except Exception as e:
            logger.error(f"Place order error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_open_positions(self, connection_id: str, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Get open positions"""
        try:
            if connection_id not in self.connections:
                return {"success": False, "error": "Not connected"}
            
            if symbol:
                positions = mt5.positions_get(symbol=symbol)
            else:
                positions = mt5.positions_get()
            
            if positions is None:
                return {"success": True, "positions": []}
            
            positions_list = []
            for pos in positions:
                positions_list.append({
                    "ticket": pos.ticket,
                    "symbol": pos.symbol,
                    "type": "BUY" if pos.type == mt5.ORDER_TYPE_BUY else "SELL",
                    "volume": pos.volume,
                    "price_open": pos.price_open,
                    "price_current": pos.price_current,
                    "profit": pos.profit,
                    "swap": pos.swap,
                    "commission": pos.commission,
                    "sl": pos.sl,
                    "tp": pos.tp,
                    "magic": pos.magic,
                    "comment": pos.comment,
                    "time": pos.time,
                    "time_update": pos.time_update,
                })
            
            return {"success": True, "positions": positions_list}
        except Exception as e:
            logger.error(f"Get open positions error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_closed_positions(
        self,
        connection_id: str,
        symbol: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get closed positions (deals history)"""
        try:
            if connection_id not in self.connections:
                return {"success": False, "error": "Not connected"}
            
            if date_from is None:
                date_from = datetime(2020, 1, 1)
            if date_to is None:
                date_to = datetime.now()
            
            if symbol:
                deals = mt5.history_deals_get(date_from, date_to, group=f"*{symbol}*")
            else:
                deals = mt5.history_deals_get(date_from, date_to)
            
            if deals is None:
                return {"success": True, "deals": []}
            
            # Filter for SIGNALIST Bot deals
            deals_list = []
            for deal in deals:
                if deal.magic == 2025:  # Our magic number
                    deals_list.append({
                        "ticket": deal.ticket,
                        "order": deal.order,
                        "symbol": deal.symbol,
                        "type": "BUY" if deal.type == mt5.DEAL_TYPE_BUY else "SELL",
                        "volume": deal.volume,
                        "price": deal.price,
                        "profit": deal.profit,
                        "swap": deal.swap,
                        "commission": deal.commission,
                        "time": deal.time,
                        "comment": deal.comment,
                    })
            
            return {"success": True, "deals": deals_list}
        except Exception as e:
            logger.error(f"Get closed positions error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def close_position(self, connection_id: str, ticket: int) -> Dict[str, Any]:
        """Close a position by ticket"""
        try:
            if connection_id not in self.connections:
                return {"success": False, "error": "Not connected"}
            
            # Get position info
            position = mt5.positions_get(ticket=ticket)
            if position is None or len(position) == 0:
                return {"success": False, "error": "Position not found"}
            
            pos = position[0]
            
            # Get current price
            tick = mt5.symbol_info_tick(pos.symbol)
            if tick is None:
                return {"success": False, "error": "Failed to get current price"}
            
            # Determine close type
            if pos.type == mt5.ORDER_TYPE_BUY:
                order_type = mt5.ORDER_TYPE_SELL
                price = tick.bid
            else:
                order_type = mt5.ORDER_TYPE_BUY
                price = tick.ask
            
            # Close position
            request_dict = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": pos.symbol,
                "volume": pos.volume,
                "type": order_type,
                "position": ticket,
                "price": price,
                "deviation": 20,
                "magic": pos.magic,
                "comment": "SIGNALIST Bot Close",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            result = mt5.order_send(request_dict)
            
            if result is None:
                return {"success": False, "error": "Close order failed"}
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    "success": False,
                    "error": f"Close failed: {result.retcode} - {result.comment}"
                }
            
            return {
                "success": True,
                "order": {
                    "order_id": result.order,
                    "deal_id": result.deal,
                    "volume": result.volume,
                    "price": result.price,
                }
            }
        except Exception as e:
            logger.error(f"Close position error: {str(e)}")
            return {"success": False, "error": str(e)}

# Initialize service
mt5_service = MT5Service()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "MT5 Trading Service"})

@app.route('/connect', methods=['POST'])
def connect():
    """Connect to MT5 account"""
    try:
        data = request.json
        login = data.get('login')
        password = data.get('password')
        server = data.get('server')
        
        if not all([login, password, server]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: login, password, server"
            }), 400
        
        result = mt5_service.login(login, password, server)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Connect error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/disconnect', methods=['POST'])
def disconnect():
    """Disconnect from MT5 account"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        
        if not connection_id:
            return jsonify({"success": False, "error": "Missing connection_id"}), 400
        
        result = mt5_service.disconnect(connection_id)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Disconnect error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/account', methods=['GET'])
def get_account():
    """Get account information"""
    try:
        connection_id = request.args.get('connection_id')
        
        if not connection_id:
            return jsonify({"success": False, "error": "Missing connection_id"}), 400
        
        result = mt5_service.get_account_info(connection_id)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get account error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/trade/buy', methods=['POST'])
def trade_buy():
    """Place a buy order"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        symbol = data.get('symbol')
        volume = data.get('volume')
        price = data.get('price')
        sl = data.get('sl')
        tp = data.get('tp')
        magic = data.get('magic', 2025)
        comment = data.get('comment', 'SIGNALIST Bot')
        
        if not all([connection_id, symbol, volume]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: connection_id, symbol, volume"
            }), 400
        
        result = mt5_service.place_order(
            connection_id=connection_id,
            symbol=symbol,
            order_type="BUY",
            volume=float(volume),
            price=float(price) if price else None,
            sl=float(sl) if sl else None,
            tp=float(tp) if tp else None,
            magic=int(magic),
            comment=comment
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Trade buy error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/trade/sell', methods=['POST'])
def trade_sell():
    """Place a sell order"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        symbol = data.get('symbol')
        volume = data.get('volume')
        price = data.get('price')
        sl = data.get('sl')
        tp = data.get('tp')
        magic = data.get('magic', 2025)
        comment = data.get('comment', 'SIGNALIST Bot')
        
        if not all([connection_id, symbol, volume]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: connection_id, symbol, volume"
            }), 400
        
        result = mt5_service.place_order(
            connection_id=connection_id,
            symbol=symbol,
            order_type="SELL",
            volume=float(volume),
            price=float(price) if price else None,
            sl=float(sl) if sl else None,
            tp=float(tp) if tp else None,
            magic=int(magic),
            comment=comment
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Trade sell error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/trades/open', methods=['GET'])
def get_open_trades():
    """Get open trades"""
    try:
        connection_id = request.args.get('connection_id')
        symbol = request.args.get('symbol')
        
        if not connection_id:
            return jsonify({"success": False, "error": "Missing connection_id"}), 400
        
        result = mt5_service.get_open_positions(connection_id, symbol)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get open trades error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/trades/closed', methods=['GET'])
def get_closed_trades():
    """Get closed trades"""
    try:
        connection_id = request.args.get('connection_id')
        symbol = request.args.get('symbol')
        
        if not connection_id:
            return jsonify({"success": False, "error": "Missing connection_id"}), 400
        
        result = mt5_service.get_closed_positions(connection_id, symbol)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Get closed trades error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/position/close', methods=['POST'])
def close_position():
    """Close a position"""
    try:
        data = request.json
        connection_id = data.get('connection_id')
        ticket = data.get('ticket')
        
        if not all([connection_id, ticket]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: connection_id, ticket"
            }), 400
        
        result = mt5_service.close_position(connection_id, int(ticket))
        return jsonify(result)
    except Exception as e:
        logger.error(f"Close position error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Initialize MT5
    if not mt5_service.initialize_mt5():
        logger.error("Failed to initialize MT5. Make sure MT5 terminal is installed and running.")
        sys.exit(1)
    
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting MT5 Trading Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)





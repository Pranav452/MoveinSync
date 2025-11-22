export interface Stop {
    stop_id: string;
    name: string;
    latitude: number;
    longitude: number;
  }
  
  export interface Path {
    path_id: string;
    path_name: string;
    ordered_list_of_stop_ids: string[];
  }
  
  export interface Route {
    route_id: string;
    route_display_name: string;
    shift_time: string;
    direction: string;
    status: 'active' | 'deactivated';
    paths?: Path;
  }
  
  export interface Vehicle {
    vehicle_id: string;
    license_plate: string;
    type: 'Bus' | 'Cab';
    capacity: number;
  }
  
  export interface Trip {
    trip_id: string;
    display_name: string;
    booking_status_percentage: number;
    live_status: 'Scheduled' | 'In Progress' | 'Completed';
    deployments?: {
      vehicle_id: string;
      driver_id: string;
    };
  }
  
  export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }
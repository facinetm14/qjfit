qjfit {
    tls internal

    handle /api/* {
        reverse_proxy api:3000
    }

    handle {
        reverse_proxy web:5173 {
            header_up Host localhost
        }
    }
}
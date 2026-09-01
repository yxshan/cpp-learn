#include <iostream>
#include <sstream>

int main() {
    std::ostringstream output;
    output << "GET " << "/docs" << "?page=" << 2;

    std::cout << "request=" << output.str() << '\n';
}

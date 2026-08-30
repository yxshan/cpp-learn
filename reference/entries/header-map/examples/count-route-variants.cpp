#include <iostream>
#include <map>
#include <string>

int main() {
    const std::multimap<std::string, std::string> routes{
        {"api", "/users"}, {"web", "/"}, {"api", "/jobs"}};

    std::cout << "api=" << routes.count("api") << '\n';
    std::cout << "web=" << routes.count("web") << '\n';
}
